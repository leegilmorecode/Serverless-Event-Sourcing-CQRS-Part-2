import {
  deleteDocumentById,
  indexDocument,
  updateDocumentById,
} from '@adapters/secondary/search-adapter';

import { eventTypes } from '@aggregates/employee-aggregate';
import { Event } from '@dto/event';
import { ValidationError } from '@errors/validation-error';
import { logger } from '@shared';
import { SQSRecord } from 'aws-lambda';

export async function eventIndexerUseCase(
  newEvent: SQSRecord
): Promise<SQSRecord> {
  const body = JSON.parse(newEvent.body);
  const message = JSON.parse(body.Message) as Event;

  // get the id and type properties from the event
  const id = message.detail.metadata.id;
  const type = message.detail.metadata.type;

  logger.info(`type: ${type} with id ${id}`);

  switch (type) {
    case eventTypes.SNAPSHOT:
    case eventTypes.EMPLOYEE_CREATED:
      // we create the full document or upsert it for a snapshot or creation event
      const employeeUpsert = {
        id,
        amount: message.detail.data.amount,
        firstName: message.detail.data.firstName,
        surname: message.detail.data.surname,
        lastUpdated: message.detail.data.datetime,
      };

      logger.info(`writing: ${JSON.stringify(employeeUpsert)} with id ${id}`);

      await indexDocument(id, employeeUpsert);
      break;
    case eventTypes.EMPLOYEE_UPDATED:
      const employeeupdate = {
        firstName: message.detail.data.firstName,
        surname: message.detail.data.surname,
        lastUpdated: message.detail.data.datetime,
      };

      logger.info(`updating: ${JSON.stringify(employeeupdate)} with id ${id}`);

      await updateDocumentById(id, employeeupdate);
      break;
    case eventTypes.LEAVE_CANCELLED:
      const leaveCancelled = {
        lastUpdated: message.detail.data.datetime,
      };

      logger.info(`updating: ${JSON.stringify(leaveCancelled)} with id ${id}`);

      await updateDocumentById(id, leaveCancelled, message.detail.data.amount);
      break;
    case eventTypes.LEAVE_REQUESTED:
      const leaveRequested = {
        lastUpdated: message.detail.data.datetime,
      };

      logger.info(`updating: ${JSON.stringify(leaveRequested)} with id ${id}`);

      await updateDocumentById(id, leaveRequested, -message.detail.data.amount);
      break;
    case eventTypes.EMPLOYEE_DELETED:
      logger.info(`deleting document with id ${id}`);
      await deleteDocumentById(id);
      break;
    default:
      const errorMessage = `event type not known: ${message.detail.metadata.type}`;
      logger.error(errorMessage);
      throw new ValidationError(errorMessage);
  }

  return newEvent;
}
