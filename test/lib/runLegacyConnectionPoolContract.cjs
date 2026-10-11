'use strict';

const ORM = require('../../backbone-orm.js');
const observe = require('./connectionPoolContractScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(ORM))}\n`);
