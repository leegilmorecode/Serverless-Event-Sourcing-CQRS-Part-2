import { queryAll } from '@adapters/secondary/search-adapter';
import { Employee } from '@dto/employee';
import { logger } from '@shared';

export async function queryEmployeeUseCase(): Promise<Employee[]> {
  try {
    return (await queryAll()) as Employee[];
  } catch (error) {
    logger.error(`error retrieving employees: ${error}`);
    throw error;
  }
}
