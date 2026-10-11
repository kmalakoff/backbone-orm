'use strict';

const runtime = require('../../dist/cjs/index.js');
const observe = require('./fabricatorTestUtilsScenario.ts').default;

process.stdout.write(`${JSON.stringify(observe(runtime))}\n`);
