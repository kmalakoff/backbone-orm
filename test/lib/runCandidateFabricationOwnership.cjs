'use strict';

const observe = require('./publicRuntimeAdoptionScenario.ts').default;
const order = process.argv[2];
if (order !== 'root-first' && order !== 'umd-first') throw new Error(`Unexpected load order: ${String(order)}`);
const first = order === 'root-first' ? require('backbone-orm') : require('backbone-orm/umd');
const installedFabricator = first.Fabricator;
const installedTestUtils = first.TestUtils;

observe(first, async () => [require('backbone-orm'), require('backbone-orm/umd'), (await import('backbone-orm')).default, (await import('backbone-orm/umd')).default]).then(
  ({ runtimes, statePreserved }) => {
    const legacy = require('../../backbone-orm.js');
    process.stdout.write(`${JSON.stringify({
      fabricatorOwned: installedFabricator !== legacy.Fabricator,
      runtimePreserved: runtimes.every((runtime) => runtime === first),
      singletonFabricator: runtimes.every((runtime) => runtime.Fabricator === installedFabricator),
      singletonRuntime: runtimes.every((runtime) => runtime === first),
      singletonTestUtils: runtimes.every((runtime) => runtime.TestUtils === installedTestUtils),
      statePreserved,
      testUtilsOwned: installedTestUtils !== legacy.TestUtils,
    })}\n`);
  }
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
