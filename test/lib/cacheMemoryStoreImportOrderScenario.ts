import { type CacheUpgradeState, observeCacheUpgrade } from './cacheUpgradeState.ts';

type Dynamic = any;

function callbackResult(register: (callback: (error?: Error | null, value?: Dynamic) => unknown) => unknown): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    register((error, value) => (error ? reject(error) : resolve(value)));
  });
}

export default async function observeCacheMemoryStoreImportOrder(
  retained: Dynamic,
  cjs: Dynamic,
  esm: Dynamic,
  Backbone: Dynamic,
  suffix: string,
  upgradeState: CacheUpgradeState
): Promise<Record<string, unknown>> {
  const upgrade = observeCacheUpgrade(upgradeState, cjs);
  esm.configure({ model_cache: { enabled: true, max: 10 } });
  class Model extends Backbone.Model {
    get model_name() {
      return `CacheImportOrder${suffix}`;
    }

    schema() {
      return { name: 'String' };
    }
  }
  const ModelType: Dynamic = Model;
  Model.prototype.sync = cjs.sync(Model);
  const saved = new ModelType({ name: suffix });
  await callbackResult((callback) => saved.save(callback));
  const found = await callbackResult((callback) => Model.find({ id: saved.id }, callback));
  const firstCache = Model.cache;
  cjs.configure({ model_cache: { enabled: true, max: 1 } });
  const afterReset = await callbackResult((callback) => Model.find({ id: saved.id }, callback));

  return {
    cacheIdentityChanged: Model.cache !== firstCache,
    cjsAndEsmRuntimeShared: cjs === esm,
    findUsesCacheAcrossEntry: found[0] === saved,
    lruConstructorShared: cjs.modules['lru-cache'] === esm.modules['lru-cache'] && cjs.modules['lru-cache'] === retained.modules['lru-cache'],
    memoryStoreShared: cjs.MemoryStore === esm.MemoryStore,
    modelCacheShared: cjs.model_cache === esm.model_cache && cjs.model_cache === retained.model_cache,
    resetRepopulatesSharedCache: Model.cache.get(saved.id) === afterReset[0],
    upgrade,
  };
}
