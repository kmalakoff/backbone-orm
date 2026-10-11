'use strict';

const Backbone = require('backbone');
const ORM = require('../../dist/cjs/index.js');
const observe = require('./cacheMemoryStoreContractScenario.ts').default;

observe(ORM, Backbone).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
