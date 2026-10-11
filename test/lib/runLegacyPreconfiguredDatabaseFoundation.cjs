'use strict';

const retained = require('../../backbone-orm.js');
const observe = require('./preconfiguredDatabaseFoundationScenario.ts').default;
const mode = process.argv[2];

observe(retained, () => retained, () => retained, mode).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
