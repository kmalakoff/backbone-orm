'use strict';

const Backbone = require('backbone');
const retained = require('../../backbone-orm.js');
const { captureFirstCacheEntry, prepareCacheUpgradeState } = require('./cacheUpgradeState.ts');
const upgradeState = prepareCacheUpgradeState(retained, 'CjsFirst');
const cjs = require('../../dist/cjs/index.js');
captureFirstCacheEntry(upgradeState, cjs);
const observe = require('./cacheMemoryStoreImportOrderScenario.ts').default;

import('../../dist/esm/index.js').then(
  ({ default: esm }) => observe(retained, cjs, esm, Backbone, 'CjsFirst', upgradeState)
).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
