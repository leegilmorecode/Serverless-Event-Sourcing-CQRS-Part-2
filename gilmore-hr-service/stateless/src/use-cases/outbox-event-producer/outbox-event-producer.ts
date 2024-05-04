import { publishMessage } from '@adapters/secondary/sns-adapter';
import { Event as EmployeeEvent } from '@aggregates/employee-aggregate';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { config } from '@config';
import { Event } from '@dto/event';
import { logger } from '@shared';
import { SQSRecord } from 'aws-lambda';

export async function outboxEventProducerUseCase(
  newEvent: SQSRecord
): Promise<SQSRecord> {
  const eventsTopicArn = config.get('eventsTopicArn');

  const body = JSON.parse(newEvent.body);
  const parsedEvent = unmarshall(body.dynamodb.NewImage) as EmployeeEvent;

  logger.info(`parsedEvent: ${JSON.stringify(parsedEvent)}`);

  // create the correct event shape to publish to sns fifo topic
  const event: Event = {
    created: parsedEvent.datetime as string,
    detail: {
      metadata: {
        domain: 'employees',
        source: 'employees-service',
        type: parsedEvent.type,
        id: parsedEvent.id as string,
      },
      data: parsedEvent,
    },
  };

  logger.info(`event: ${JSON.stringify(event)}`);

  // create the correct message group id
  const { domain, source, id } = event.detail.metadata;
  const messageGroupId = `${domain}.${source}.${id}`;

  // publish the message
  await publishMessage(eventsTopicArn, JSON.stringify(event), messageGroupId);

  return newEvent;
}
