'use strict';

const ORM = require('../../backbone-orm.js');
const observe = require('./databaseFoundationContractScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(ORM))}\n`);
