'use strict';

const retained = require('../../backbone-orm.js');
const value = { id: 'before-install' };
retained.ConnectionPool.set('before-install', value);
const retainedSnapshot = {
  cache: retained.ConnectionPool.cache,
  methods: ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => retained.ConnectionPool[key]),
  prototype: Object.getPrototypeOf(retained.ConnectionPool),
};
const first = require('../../dist/cjs/index.js');
retainedSnapshot.installedAdditiveMethods = [first.ConnectionPool.setOwned, first.ConnectionPool.dispose, first.ConnectionPool.disposeAll];
retainedSnapshot.installedSynchronousMethods = ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => first.ConnectionPool[key]);
const observe = require('./connectionPoolImportOrderScenario.ts').default;

import('../../dist/esm/index.js').then(({ default: second }) => observe(retained, first, second, value, retainedSnapshot)).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
