'use strict';

const observe = require('./publicRuntimeAdoptionScenario.ts').default;
const order = process.argv[2];
if (order !== 'root-first' && order !== 'umd-first') throw new Error(`Unexpected load order: ${String(order)}`);
const first = order === 'root-first' ? require('backbone-orm') : require('backbone-orm/umd');
const installedJSONUtils = first.JSONUtils;

observe(first, async () => [require('backbone-orm'), require('backbone-orm/umd'), (await import('backbone-orm')).default, (await import('backbone-orm/umd')).default]).then(
  ({ runtimes, statePreserved }) => {
    const legacy = require('../../backbone-orm.js');
    process.stdout.write(`${JSON.stringify({
      implementationsShared: runtimes.every((runtime) => runtime.JSONUtils === installedJSONUtils),
      jsonUtilsOwned: installedJSONUtils !== legacy.JSONUtils,
      singletonPreserved: runtimes.every((runtime) => runtime === first),
      statePreserved,
    })}\n`);
  }
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
