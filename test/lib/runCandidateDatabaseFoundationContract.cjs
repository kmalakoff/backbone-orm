'use strict';

const ORM = require('../../dist/cjs/index.js');
const observe = require('./databaseFoundationContractScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(ORM))}\n`);
