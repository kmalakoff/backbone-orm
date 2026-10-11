'use strict';

const ORM = require('../../backbone-orm.js');
const observe = require('./utilityContractScenario.ts').default;

observe(ORM).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
