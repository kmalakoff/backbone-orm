'use strict';

const ORM = require('../../dist/cjs/index.js');
const observe = require('./modelExtensionContractScenario.ts').default;

observe(ORM, 'Candidate').then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
