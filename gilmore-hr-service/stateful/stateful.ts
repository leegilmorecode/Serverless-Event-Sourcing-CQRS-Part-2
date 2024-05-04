import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';

import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface GilmoreHrServiceStatefulStackProps extends cdk.StackProps {
  collectionName: string;
}

export class GilmoreHrServiceStatefulStack extends cdk.Stack {
  public table: dynamodb.Table;
  public eventsTopic: sns.Topic;
  public centralEventBus: events.EventBus;
  public eventsPublisherQueue: sqs.Queue;
  public eventsIndexingQueue: sqs.Queue;
  public openSearchDomain: string;
  public openSearchCollection: opensearch.CfnCollection;
  private collectionName: string;

  constructor(
    scope: Construct,
    id: string,
    props: GilmoreHrServiceStatefulStackProps
  ) {
    super(scope, id, props);

    const { collectionName } = props;

    this.collectionName = collectionName;

    // create the opensearch serverless collection
    this.openSearchCollection = new opensearch.CfnCollection(
      this,
      'OpenSearchCollection',
      {
        name: `${this.collectionName}`,
        type: 'SEARCH',
        description: `${this.collectionName}`,
      }
    );
    this.openSearchCollection.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create the opensearch serverless encryption policy
    const encryptionPolicy = new opensearch.CfnSecurityPolicy(
      this,
      'CollectionEncryptionPolicy',
      {
        name: `encryption-policy`,
        type: 'encryption',
        description: 'Encryption policy for the employees collection',
        policy: `{"Rules":[{"ResourceType":"collection","Resource":["collection/${this.collectionName}"]}],"AWSOwnedKey":true}`,
      }
    );

    // create the network policy to allow public access
    const networkPolicy = new opensearch.CfnSecurityPolicy(
      this,
      'CollectionNetworkPolicy',
      {
        name: `network-policy`,
        type: 'network',
        description: 'Network policy for employees collection',
        policy: `[{"Rules":[{"ResourceType":"collection","Resource":["collection/${this.collectionName}"]}, {"ResourceType":"dashboard","Resource":["collection/${this.collectionName}"]}],"AllowFromPublic":true}]`,
      }
    );

    // add the user access policy for the employees collection
    const userAccessPolicy = new opensearch.CfnAccessPolicy(
      this,
      'CollectionUserAccessPolicy',
      {
        name: `user-access-policy`,
        type: 'data',
        description: 'Access policy for employees collection',
        policy: `[{"Description":"Access for employees collection","Rules":[{"ResourceType":"index","Resource":["index/*/*"],"Permission":["aoss:*"]}, {"ResourceType":"collection","Resource":["collection/${this.collectionName}"],"Permission":["aoss:*"]}], "Principal":["arn:aws:iam::${this.account}:user/admin"]}]`,
      }
    );

    this.openSearchCollection.addDependency(encryptionPolicy);
    this.openSearchCollection.addDependency(networkPolicy);
    this.openSearchCollection.addDependency(userAccessPolicy);

    // create our event publisher queue
    this.eventsPublisherQueue = new sqs.Queue(this, 'EventsPublisherQueue', {
      queueName: 'events-publisher-queue.fifo',
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      contentBasedDeduplication: true,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'EventsPublisherQueueDlq', {
          fifo: true,
          queueName: 'events-publisher-queue-dlq.fifo',
        }),
      },
    });

    // create our indexing queue
    this.eventsIndexingQueue = new sqs.Queue(this, 'EventsIndexingQueue', {
      queueName: 'events-indexing-queue.fifo',
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      contentBasedDeduplication: true,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'EventsIndexingQueueDlq', {
          fifo: true,
          queueName: 'events-indexing-queue-dlq.fifo',
        }),
      },
    });

    // create our central event bus
    this.centralEventBus = new events.EventBus(this, 'CentralEventBus', {
      eventBusName: 'gilmore-hr-central-event-bus',
    });
    this.centralEventBus.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create a central event bus log group
    const centralEventLogs: logs.LogGroup = new logs.LogGroup(
      this,
      'central-event-bus-logs',
      {
        logGroupName: 'central-event-bus-logs',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    // log all events to cloudwatch so we can track what is happening and monitor
    // i.e. this should only be for non-prod
    const centralEventLoggingRule = new events.Rule(
      this,
      'LogAllCentralBusEventsToCloudwatch',
      {
        eventBus: this.centralEventBus,
        ruleName: 'LogAllCentralBusEventsToCloudwatch',
        description: 'log all central bus events',
        eventPattern: {
          source: [{ prefix: '' }] as any[],
        },
        targets: [new targets.CloudWatchLogGroup(centralEventLogs)],
      }
    );
    centralEventLoggingRule.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create the sns fifo topic
    this.eventsTopic = new sns.Topic(this, 'EventsTopic', {
      topicName: 'events-topic',
      displayName: 'events-topic',
      fifo: true, // fifo topic
      contentBasedDeduplication: true,
    });
    this.eventsTopic.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // create the dynamodb table for storing the employee and leave records together
    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'gilmore-hr-table',
      stream: dynamodb.StreamViewType.NEW_IMAGE, // we use dynamodb streams
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // allow the queues to subscribe to the topics
    this.eventsTopic.addSubscription(
      new SqsSubscription(this.eventsPublisherQueue, {
        rawMessageDelivery: false,
      })
    );

    this.eventsTopic.addSubscription(
      new SqsSubscription(this.eventsIndexingQueue, {
        rawMessageDelivery: false,
      })
    );

    // create the events pipe role
    const pipeRole = new iam.Role(this, 'EventsCentralBusPipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });

    // add the eventbridge pipe for the central bus delivery
    new pipes.CfnPipe(this, 'CentralEventsStreamPipe', {
      roleArn: pipeRole.roleArn,
      source: this.eventsPublisherQueue.queueArn,
      target: this.centralEventBus.eventBusArn,
    });

    // allow the pipe role to put events on the central bus and consume messages from the queue
    this.eventsPublisherQueue.grantConsumeMessages(pipeRole);
    this.centralEventBus.grantPutEventsTo(pipeRole);

    // access the domain endpoint
    this.openSearchDomain = this.openSearchCollection.attrCollectionEndpoint;

    // cdk stack outputs
    new cdk.CfnOutput(this, 'openSearchCollectionArn', {
      value: this.openSearchCollection.attrArn,
      description: 'OpenSearch serverless collection arn',
      exportName: 'openSearchCollectionArn',
    });

    new cdk.CfnOutput(this, 'openSearchDashboardUrl', {
      value: this.openSearchCollection.attrDashboardEndpoint,
      description: 'OpenSearch serverless dashboard url',
      exportName: 'openSearchDashboardUrl',
    });

    new cdk.CfnOutput(this, 'openSearchDomainEndpoint', {
      value: this.openSearchCollection.attrCollectionEndpoint,
      description: 'OpenSearch serverless domain endpoint',
      exportName: 'openSearchDomainEndpoint',
    });
  }
}
