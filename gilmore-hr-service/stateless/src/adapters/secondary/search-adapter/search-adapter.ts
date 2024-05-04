import * as os from '@opensearch-project/opensearch';
import * as aws4 from 'aws4';

import { config } from '@config';
import { Client } from '@opensearch-project/opensearch';
import { logger } from '@shared';

const indexName = config.get('indexName');
const indexDomain = config.get('indexDomain');

async function getClient(): Promise<Client> {
  // https://github.com/awsdocs/amazon-opensearch-service-developer-guide/blob/master/doc_source/serverless-sdk.md#serverless-sdk-javascript
  return new Client({
    node: indexDomain,
    Connection: class AmazonConnection extends os.Connection {
      buildRequestObject(params: any) {
        let request = super.buildRequestObject(params) as aws4.Request;
        request.service = 'aoss';
        request.region = 'eu-west-1';
        request.headers = request.headers || {};

        const body = request.body;
        delete request.headers['content-length'];
        request.body = undefined;

        const signedRequest = aws4.sign(request);
        signedRequest.body = body;

        return signedRequest;
      }
    },
  });
}

export async function indexDocument(
  id: string,
  document: Record<string, any>
): Promise<void> {
  const documentId = id;

  logger.info(`indexName: ${indexName}, indexDomain: ${indexDomain}`);

  try {
    const client = await getClient();

    // check if the index exists
    const indexExists = await client.indices.exists({ index: indexName });

    if (!indexExists.body) {
      // create the index if it doesn't exist
      await client.indices.create({
        index: indexName,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              firstName: { type: 'text' },
              surname: { type: 'text' },
              amount: { type: 'integer' },
              lastUpdated: { type: 'date' },
            },
          },
        },
      });
      logger.info(`Index ${indexName} created.`);
    }

    const response = await client.index({
      index: indexName,
      id: documentId,
      body: document,
    });

    logger.info(
      `document ${response.body._id} indexed with body ${JSON.stringify(
        document
      )}`
    );
  } catch (error) {
    logger.error(`error indexing document: ${error}`);
    throw error;
  }
}

export async function queryAll(): Promise<Record<string, any>> {
  try {
    logger.info(`indexName: ${indexName}, indexDomain: ${indexDomain}`);

    const client = await getClient();
    const response = await client.search({
      index: indexName,
    });

    logger.info(`reponse: ${JSON.stringify(response)}`);

    return response.body.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    logger.error(`error retrieving all documents: ${error}`);
    throw error;
  }
}

export async function getDocumentById(
  id: string
): Promise<Record<string, any>> {
  try {
    logger.info(`indexName: ${indexName}, indexDomain: ${indexDomain}`);

    const client = await getClient();
    const response = await client.get({
      index: indexName,
      id,
    });

    logger.info(`retrieved document: ${JSON.stringify(response.body)}`);

    return response.body;
  } catch (error) {
    logger.error(`error retrieving document: ${error}`);
    throw error;
  }
}

export async function deleteDocumentById(id: string): Promise<void> {
  try {
    logger.info(`indexName: ${indexName}, indexDomain: ${indexDomain}`);

    const client = await getClient();
    await client.delete({
      index: indexName,
      id,
    });
    logger.info(`deleted document with id: ${id}`);
  } catch (error) {
    logger.error(`error deleting document: ${error}`);
    throw error;
  }
}

export async function updateDocumentById(
  id: string,
  partialDocument: Record<string, any>,
  amountChange?: number
): Promise<void> {
  try {
    logger.info(`indexName: ${indexName}, indexDomain: ${indexDomain}`);
    const client = await getClient();

    // update the 'amount' field using a script, if amountChange is provided
    if (amountChange !== undefined) {
      const scriptResponse = await client.update({
        index: indexName,
        id,
        body: {
          script: {
            source: 'ctx._source.amount += params.amountChange',
            params: {
              amountChange: amountChange,
            },
          },
        },
      });
      logger.info(
        `document ${scriptResponse.body._id} updated with amount change ${amountChange}`
      );
    }

    // next, update other fields using the partial document
    const docResponse = await client.update({
      index: indexName,
      id,
      body: {
        doc: partialDocument,
      },
    });

    logger.info(
      `document ${docResponse.body._id} updated with body ${JSON.stringify(
        partialDocument
      )}`
    );
  } catch (error) {
    logger.error(`error updating document: ${error}`);
    throw error;
  }
}
