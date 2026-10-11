'use strict';

const Backbone = require('backbone');
const ORM = require('../../dist/cjs/index.js');
const observe = require('./schemaRelationContractScenario.ts').default;

observe(ORM, Backbone, true).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
