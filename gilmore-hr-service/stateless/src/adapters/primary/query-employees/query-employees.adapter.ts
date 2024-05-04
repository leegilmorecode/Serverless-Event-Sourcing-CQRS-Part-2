import { MetricUnit, Metrics } from '@aws-lambda-powertools/metrics';
import { errorHandler, logger } from '@shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { Employee } from '@dto/employee';
import middy from '@middy/core';
import { queryEmployeeUseCase } from '@use-cases/query-employees';

const tracer = new Tracer();
const metrics = new Metrics();

export const queryEmployeesAdapter =
  async ({}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const employees: Employee[] = await queryEmployeeUseCase();
      const response = {
        count: employees.length,
        employees,
      };

      metrics.addMetric('SuccessfulQueryEmployees', MetricUnit.Count, 1);

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) errorMessage = error.message;
      logger.error(errorMessage);

      metrics.addMetric('QueryEmployeesError', MetricUnit.Count, 1);

      return errorHandler(error);
    }
  };

export const handler = middy(queryEmployeesAdapter)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));
