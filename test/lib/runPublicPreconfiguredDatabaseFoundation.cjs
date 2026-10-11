'use strict';

const retained = require('backbone-orm/umd');
const observe = require('./preconfiguredDatabaseFoundationScenario.ts').default;
const mode = process.argv[2];

observe(
  retained,
  () => require('backbone-orm'),
  () => import('backbone-orm').then((module) => module.default),
  mode
).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
