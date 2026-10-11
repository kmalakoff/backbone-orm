import type { RuntimeMemoryUtils } from '../memory/contracts.ts';
import type { BackboneORMRuntime } from '../types.ts';
import { installCacheSyncDependencies } from './CacheSync.ts';
import MemoryStore, { installMemoryStoreDependencies } from './MemoryStore.ts';
import ModelCache, { installModelCacheDependencies, type ModelCacheInstance } from './ModelCache.ts';

const cacheStateKey = Symbol.for('backbone-orm.cache.owned-state');

interface CacheRuntime extends BackboneORMRuntime {
  model_cache: ModelCacheInstance;
  modules: {
    'lru-cache': Parameters<typeof installMemoryStoreDependencies>[0];
  };
  _: Parameters<typeof installModelCacheDependencies>[0] & Parameters<typeof installMemoryStoreDependencies>[1];
}

interface CacheState {
  MemoryStore: typeof MemoryStore;
  modelCache: ModelCacheInstance;
}

type StatefulCacheRuntime = CacheRuntime & {
  [cacheStateKey]?: CacheState;
};

export default function installOwnedCache(inputRuntime: BackboneORMRuntime): void {
  const runtime = inputRuntime as StatefulCacheRuntime;
  const installed = runtime[cacheStateKey];
  if (installed) {
    runtime.MemoryStore = installed.MemoryStore;
    return;
  }

  installMemoryStoreDependencies(runtime.modules['lru-cache'], runtime._);
  installModelCacheDependencies(runtime._);
  installCacheSyncDependencies(runtime.Utils as RuntimeMemoryUtils, runtime);

  const modelCache = runtime.model_cache;
  Object.setPrototypeOf(modelCache, ModelCache.prototype);
  runtime.MemoryStore = MemoryStore;
  Object.defineProperty(runtime, cacheStateKey, { value: { MemoryStore, modelCache } });
}
