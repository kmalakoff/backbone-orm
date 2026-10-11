import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const observe = require('./connectionPoolImportOrderScenario.ts').default;
const retained = require('../../backbone-orm.js');
const value = { id: 'before-install' };
retained.ConnectionPool.set('before-install', value);
const retainedSnapshot = {
  cache: retained.ConnectionPool.cache,
  methods: ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => retained.ConnectionPool[key]),
  prototype: Object.getPrototypeOf(retained.ConnectionPool),
};
const { default: first } = await import('../../dist/esm/index.js');
retainedSnapshot.installedAdditiveMethods = [first.ConnectionPool.setOwned, first.ConnectionPool.dispose, first.ConnectionPool.disposeAll];
retainedSnapshot.installedSynchronousMethods = ['set', 'get', 'destroy', 'del', 'reset', 'forEach'].map((key) => first.ConnectionPool[key]);
const second = require('../../dist/cjs/index.js');

try {
  process.stdout.write(`${JSON.stringify(await observe(retained, first, second, value, retainedSnapshot))}\n`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
