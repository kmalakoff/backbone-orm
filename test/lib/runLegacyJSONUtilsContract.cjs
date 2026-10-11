'use strict';

const ORM = require('../../backbone-orm.js');
const observe = require('./jsonUtilsContractScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(ORM))}\n`);
