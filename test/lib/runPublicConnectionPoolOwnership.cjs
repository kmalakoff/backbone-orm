'use strict';

const retained = require('backbone-orm/umd');
const observe = require('./connectionPoolImportOrderScenario.ts').default;
const mode = process.argv[2];
const value = { id: 'before-install' };
retained.ConnectionPool.set('before-install', value);
const retainedSnapshot = {
  cache: retained.ConnectionPool.cache,
  methods: ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => retained.ConnectionPool[key]),
  prototype: Object.getPrototypeOf(retained.ConnectionPool),
};

const loadCjs = () => Promise.resolve(require('backbone-orm'));
const loadEsm = () => import('backbone-orm').then((module) => module.default);
const loadFirst = mode === 'esm-first' ? loadEsm : loadCjs;
const loadSecond = mode === 'esm-first' ? loadCjs : loadEsm;

loadFirst()
  .then((first) => {
    retainedSnapshot.installedAdditiveMethods = [first.ConnectionPool.setOwned, first.ConnectionPool.dispose, first.ConnectionPool.disposeAll];
    retainedSnapshot.installedSynchronousMethods = ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => first.ConnectionPool[key]);
    return loadSecond().then((second) => observe(retained, first, second, value, retainedSnapshot));
  })
  .then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
