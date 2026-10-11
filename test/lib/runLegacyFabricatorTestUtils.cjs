'use strict';

const runtime = require('../../backbone-orm.js');
const observe = require('./fabricatorTestUtilsScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(runtime))}\n`);
