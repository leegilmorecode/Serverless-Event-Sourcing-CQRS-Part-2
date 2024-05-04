#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { GilmoreHrServiceStatefulStack } from '../stateful/stateful';
import { GilmoreHrServiceStatelessStack } from '../stateless/stateless';

const app = new cdk.App();

// the opensearch configuration details
const collectionName = 'employees-collection';
const indexName = 'employees';

const gilmoreHrServiceStatefulStack = new GilmoreHrServiceStatefulStack(
  app,
  'GilmoreHrServiceStatefulStack',
  {
    collectionName,
  }
);
new GilmoreHrServiceStatelessStack(app, 'GilmoreHrServiceStatelessStack', {
  table: gilmoreHrServiceStatefulStack.table,
  eventsTopic: gilmoreHrServiceStatefulStack.eventsTopic,
  eventsIndexingQueue: gilmoreHrServiceStatefulStack.eventsIndexingQueue,
  openSearchDomain: gilmoreHrServiceStatefulStack.openSearchDomain,
  collectionName,
  indexName,
});
