'use strict';

const observe = require('./publicRuntimeAdoptionScenario.ts').default;
const order = process.argv[2];
if (order !== 'root-first' && order !== 'umd-first') throw new Error(`Unexpected load order: ${String(order)}`);
const first = order === 'root-first' ? require('backbone-orm') : require('backbone-orm/umd');
const installed = {
  BaseConvention: first.BaseConvention,
  DatabaseURL: first.DatabaseURL,
  configure: first.configure,
  findOrGenerateModelName: first.Utils.findOrGenerateModelName,
};

observe(first, async () => [require('backbone-orm'), require('backbone-orm/umd'), (await import('backbone-orm')).default, (await import('backbone-orm/umd')).default]).then(
  ({ runtimes, statePreserved }) => {
    const legacy = require('../../backbone-orm.js');
    process.stdout.write(`${JSON.stringify({
      baseConventionOwned: installed.BaseConvention !== legacy.BaseConvention,
      configureOwned: installed.configure !== legacy.configure,
      databaseURLOwned: installed.DatabaseURL !== legacy.DatabaseURL,
      findOrGenerateModelNameOwned: installed.findOrGenerateModelName !== legacy.Utils.findOrGenerateModelName,
      implementationsShared: runtimes.every((runtime) => runtime.BaseConvention === installed.BaseConvention && runtime.configure === installed.configure && runtime.DatabaseURL === installed.DatabaseURL && runtime.Utils.findOrGenerateModelName === installed.findOrGenerateModelName),
      singletonPreserved: runtimes.every((runtime) => runtime === first),
      statePreserved,
    })}\n`);
  }
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
