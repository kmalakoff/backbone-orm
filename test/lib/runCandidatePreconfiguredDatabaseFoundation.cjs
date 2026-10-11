'use strict';

const observe = require('./preconfiguredDatabaseFoundationScenario.ts').default;
const mode = process.argv[2];
const order = process.argv[3];
if (order !== 'root-first' && order !== 'umd-first') throw new Error(`Unexpected load order: ${String(order)}`);
const first = order === 'root-first' ? require('backbone-orm') : require('backbone-orm/umd');

observe(
  first,
  () => order === 'root-first' ? require('backbone-orm/umd') : require('backbone-orm'),
  () => import('backbone-orm').then((module) => module.default),
  mode
).then(
  async (observation) => {
    const marker = first.preinstall_marker;
    const convention = first.naming_conventions;
    const runtimes = [require('backbone-orm'), require('backbone-orm/umd'), (await import('backbone-orm')).default, (await import('backbone-orm/umd')).default];
    process.stdout.write(`${JSON.stringify({
      observation,
      publicEntriesShared: runtimes.every((runtime) => runtime === first),
      publicMarkerPreserved: runtimes.every((runtime) => runtime.preinstall_marker === marker),
      publicNamingPreserved: runtimes.every((runtime) => runtime.naming_conventions === convention),
    })}\n`);
  }
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
