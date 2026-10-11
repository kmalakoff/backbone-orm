import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'assert';

const helper = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/runNodeBootstrapLoadOrder.cjs');

function observe(order: 'root-first' | 'umd-first'): Record<string, unknown> {
  const result = spawnSync(process.execPath, [helper, order], {
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  assert.strictEqual(result.signal, null, result.stderr);
  assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe('cold Node bootstrap', () => {
  for (const order of ['root-first', 'umd-first'] as const) {
    it(`shares one owned runtime with ${order}`, () => {
      assert.deepStrictEqual(observe(order), {
        initial: {
          collectionOriginalsMissing: true,
          legacyBundleMissingFromCache: true,
          modelCache: {
            caches: [],
            enabled: false,
            options: { modelTypes: {} },
            verbose: false,
          },
          naming: {
            focusModel: 'Focu',
            focusTable: 'focus',
            octopusPlural: 'octopi',
          },
          patchMissingReturn: false,
          poolEntries: [],
        },
        identity: {
          allRuntimeEntries: true,
          backbone: true,
          configureModel: true,
          connectionPool: true,
          modelCache: true,
          modules: true,
          underscore: true,
          utils: true,
          utilsPatchRemove: true,
        },
        providers: {
          inflection: '1.8.0',
          lruCache: '4.0.0',
        },
        collectionOwnership: {
          fetchOwned: true,
          originalsCaptured: true,
          prepareModelOwned: true,
        },
        persistence: {
          childCache: true,
          parentCache: true,
          relationCount: 2,
        },
        resolution: {
          legacyBundleMissingFromCache: true,
          umdNodeWrapper: true,
        },
        statePreserved: {
          cacheEnabled: true,
          cacheMax: true,
          naming: true,
          poolEntry: true,
        },
        umdSha256: '967b374060b69d5e4067f3193885f3ef3cd115217ec71a63587598e7fa4c7ea7',
        utils: {
          rootCJS: {
            callReturnsUndefined: true,
            constructorIdentity: true,
            instanceOf: true,
            name: 'Utils',
            ownKeys: [],
            staticMethods: {
              configureModelType: 'function',
              patchRemove: 'function',
              updateOrNew: 'function',
            },
          },
          rootESM: {
            callReturnsUndefined: true,
            constructorIdentity: true,
            instanceOf: true,
            name: 'Utils',
            ownKeys: [],
            staticMethods: {
              configureModelType: 'function',
              patchRemove: 'function',
              updateOrNew: 'function',
            },
          },
          umdCJS: {
            callReturnsUndefined: true,
            constructorIdentity: true,
            instanceOf: true,
            name: 'Utils',
            ownKeys: [],
            staticMethods: {
              configureModelType: 'function',
              patchRemove: 'function',
              updateOrNew: 'function',
            },
          },
          umdESM: {
            callReturnsUndefined: true,
            constructorIdentity: true,
            instanceOf: true,
            name: 'Utils',
            ownKeys: [],
            staticMethods: {
              configureModelType: 'function',
              patchRemove: 'function',
              updateOrNew: 'function',
            },
          },
        },
      });
    });
  }
});
