const convict = require('convict');

export const config = convict({
  tableName: {
    doc: 'The table name',
    format: String,
    default: '',
    env: 'TABLE_NAME',
  },
  eventsTopicArn: {
    doc: 'The arn of the events topic',
    format: String,
    default: '',
    env: 'TOPIC_ARN',
  },
  indexName: {
    doc: 'the name of the index for search',
    format: String,
    default: '',
    env: 'INDEX_NAME',
  },
  indexDomain: {
    doc: 'the domain for search',
    format: String,
    default: '',
    env: 'DOMAIN',
  },
}).validate({ allowed: 'strict' });
