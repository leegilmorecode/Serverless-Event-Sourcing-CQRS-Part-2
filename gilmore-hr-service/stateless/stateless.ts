import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';

import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

interface GilmoreHrServiceStatelessStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  eventsTopic: sns.Topic;
  eventsIndexingQueue: sqs.Queue;
  collectionName: string;
  openSearchDomain: string;
  indexName: string;
}

export class GilmoreHrServiceStatelessStack extends cdk.Stack {
  private table: dynamodb.Table;
  private eventsStreamQueue: sqs.Queue;
  private eventsTopic: sns.Topic;
  private eventsIndexingQueue: sqs.Queue;
  private collectionName: string;
  private openSearchDomain: string;
  private indexName: string;

  constructor(
    scope: Construct,
    id: string,
    props: GilmoreHrServiceStatelessStackProps
  ) {
    super(scope, id, props);

    const {
      table,
      eventsTopic,
      eventsIndexingQueue,
      collectionName,
      openSearchDomain,
      indexName,
    } = props;

    this.table = table;
    this.eventsTopic = eventsTopic;
    this.eventsIndexingQueue = eventsIndexingQueue;
    this.collectionName = collectionName;
    this.openSearchDomain = openSearchDomain;
    this.indexName = indexName;

    const lambdaPowerToolsConfig = {
      LOG_LEVEL: 'DEBUG',
      POWERTOOLS_LOGGER_LOG_EVENT: 'true',
      POWERTOOLS_LOGGER_SAMPLE_RATE: '1',
      POWERTOOLS_TRACE_ENABLED: 'enabled',
      POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'captureHTTPsRequests',
      POWERTOOLS_SERVICE_NAME: 'employee-service',
      POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'captureResult',
      POWERTOOLS_METRICS_NAMESPACE: 'Gilmore-HR',
    };

    // create our lambda functions for the api
    const getEmployeeLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'GetEmployeeLambda', {
        functionName: 'hr-get-employee-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/get-employee/get-employee.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    const createEmployeeLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'CreateEmployeeLambda', {
        functionName: 'hr-create-employee-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/create-employee/create-employee.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    const updateEmployeeLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'UpdateEmployeeLambda', {
        functionName: 'hr-update-employee-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/update-employee/update-employee.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    const deleteEmployeeLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'DeleteEmployeeLambda', {
        functionName: 'hr-delete-employee-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/delete-employee/delete-employee.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    const updateLeaveLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'UpdateLeaveLambda', {
        functionName: 'hr-update-leave-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/update-leave/update-leave.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          ...lambdaPowerToolsConfig,
          TABLE_NAME: this.table.tableName,
        },
      });

    const queryEmployeesLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'QueryEmployeesLambda', {
        functionName: 'hr-query-employees-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/query-employees/query-employees.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          DOMAIN: this.openSearchDomain,
          INDEX_NAME: this.indexName,
          ...lambdaPowerToolsConfig,
        },
      });

    // give the functions access to the table
    this.table.grantReadData(getEmployeeLambda);
    this.table.grantReadWriteData(createEmployeeLambda);
    this.table.grantReadWriteData(updateEmployeeLambda);
    this.table.grantReadWriteData(updateLeaveLambda);
    this.table.grantReadWriteData(deleteEmployeeLambda);

    // create the api for the emplopyee service
    const api: apigw.RestApi = new apigw.RestApi(this, 'Api', {
      description: 'Gilmore HR API',
      deploy: true,
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    // create our employee api
    const root: apigw.Resource = api.root.addResource('v1');
    const employees: apigw.Resource = root.addResource('employees');
    const employee: apigw.Resource = employees.addResource('{id}');
    const requests: apigw.Resource = employee.addResource('requests');

    // add a post endpoint so we can create new employees
    employees.addMethod(
      'POST',
      new apigw.LambdaIntegration(createEmployeeLambda, {
        proxy: true,
      })
    );

    // add a GET endpoint so we can query all employees
    employees.addMethod(
      'GET',
      new apigw.LambdaIntegration(queryEmployeesLambda, {
        proxy: true,
      })
    );

    // add a get endpoint so we can return a current employee (just to show event sourcing in action)
    employee.addMethod(
      'GET',
      new apigw.LambdaIntegration(getEmployeeLambda, {
        proxy: true,
      })
    );

    // add a patch endpoint so we can update the current employee
    employee.addMethod(
      'PATCH',
      new apigw.LambdaIntegration(updateEmployeeLambda, {
        proxy: true,
      })
    );

    // add a delete endpoint so we can delete the current employee
    employee.addMethod(
      'DELETE',
      new apigw.LambdaIntegration(deleteEmployeeLambda, {
        proxy: true,
      })
    );

    // add a post endpoint so we can cancel and request leave
    requests.addMethod(
      'POST',
      new apigw.LambdaIntegration(updateLeaveLambda, {
        proxy: true,
      })
    );

    // create our events outbox queue from a dynamodb stream via pipes (our outbox)
    this.eventsStreamQueue = new sqs.Queue(this, 'EventStreamsQueue', {
      queueName: 'events-stream-queue.fifo',
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, 'EventStreamsQueueDlq', {
          fifo: true,
          queueName: 'events-stream-queue-dlq.fifo',
        }),
      },
    });

    // create the 'outbox processor' lambda which reads from the stream fifo queue
    const outboxEventProducer: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'OutboxEventProducer', {
        functionName: 'hr-outbox-event-producer-lambda',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/outbox-event-producer/outbox-event-producer.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          TOPIC_ARN: this.eventsTopic.topicArn,
        },
      });

    // create the lambda function that indexes the changes into opensearch
    const eventIndexerLambda: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, 'EventIndexerLambda', {
        functionName: 'hr-event-indexer',
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          'src/adapters/primary/index-processor/index-processor.adapter.ts'
        ),
        memorySize: 1024,
        handler: 'handler',
        tracing: lambda.Tracing.ACTIVE,
        bundling: {
          minify: true,
        },
        environment: {
          ...lambdaPowerToolsConfig,
          DOMAIN: this.openSearchDomain,
          INDEX_NAME: this.indexName,
        },
      });

    // allow the indexing lambda to write to the index in opensearch serverless
    eventIndexerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['es:ESHttpPost', 'es:ESHttpPut', 'aoss:*'],
        resources: ['*'],
      })
    );

    // allow the lambda to query the index in opensearch serverless
    queryEmployeesLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['es:ESHttpGet', 'aoss:*'],
        resources: ['*'],
      })
    );

    // add the data policy to the indexing lambda role
    new opensearch.CfnAccessPolicy(this, 'EmployeesIndexingDataPolicy', {
      name: 'employees-indexing-data-policy',
      policy: `[{"Description": "Indexing access from lambda role", "Rules":[{"ResourceType":"index","Resource":["index/${this.collectionName}/*"],"Permission":["aoss:*"]}, {"ResourceType":"collection","Resource":["collection/${this.collectionName}"],"Permission":["aoss:*"]}], "Principal":["${eventIndexerLambda.role?.roleArn}"]}]`,
      type: 'data',
    });

    // add the data policy to the query lambda role
    new opensearch.CfnAccessPolicy(this, 'EmployeesQueryDataPolicy', {
      name: 'employees-query-data-policy',
      policy: `[{"Description": "Query access from lambda role", "Rules":[{"ResourceType":"index","Resource":["index/${this.collectionName}/*"],"Permission":["aoss:*"]}, {"ResourceType":"collection","Resource":["collection/${this.collectionName}"],"Permission":["aoss:*"]}], "Principal":["${queryEmployeesLambda.role?.roleArn}"]}]`,
      type: 'data',
    });

    // allow the lambda function to read from the indexing queue
    eventIndexerLambda.addEventSource(
      new SqsEventSource(this.eventsIndexingQueue, {
        batchSize: 1,
        maxConcurrency: 2,
        reportBatchItemFailures: true,
      })
    );

    // allow the lambda to process messages from the queue and publish to the topic
    this.eventsStreamQueue.grantConsumeMessages(outboxEventProducer);
    this.eventsTopic.grantPublish(outboxEventProducer);

    // ensure our lambda function is invoked from the queue
    outboxEventProducer.addEventSource(
      new SqsEventSource(this.eventsStreamQueue, {
        batchSize: 1,
        maxConcurrency: 5,
        reportBatchItemFailures: true,
      })
    );

    // create the events pipe role
    const eventsOutboxPipeRole = new iam.Role(this, 'EventsOutboxPipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });

    // add the eventbridge pipe for the stream
    new pipes.CfnPipe(this, 'OutboxStreamPipe', {
      roleArn: eventsOutboxPipeRole.roleArn,
      source: this.table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          batchSize: 1,
          maximumRetryAttempts: 3,
        },
      },
      target: this.eventsStreamQueue.queueArn,
      targetParameters: {
        sqsQueueParameters: {
          messageDeduplicationId: '$.eventID',
          messageGroupId: '$.dynamodb.Keys.id.S',
        },
      },
    });

    this.table.grantStreamRead(eventsOutboxPipeRole);
    this.eventsStreamQueue.grantSendMessages(eventsOutboxPipeRole);
  }
}
