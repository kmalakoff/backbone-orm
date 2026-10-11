import Backbone from 'backbone';
import { createRequire } from 'node:module';

import observe from './cacheMemoryStoreImportOrderScenario.ts';
import { captureFirstCacheEntry, prepareCacheUpgradeState } from './cacheUpgradeState.ts';

const require = createRequire(import.meta.url);
const retained = require('../../backbone-orm.js');
const upgradeState = prepareCacheUpgradeState(retained, 'EsmFirst');
const { default: esm } = await import('../../dist/esm/index.js');
captureFirstCacheEntry(upgradeState, esm);
const cjs = require('../../dist/cjs/index.js');

try {
  const result = await observe(retained, cjs, esm, Backbone, 'EsmFirst', upgradeState);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
