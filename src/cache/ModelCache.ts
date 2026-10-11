import type { MemoryModelConstructor } from '../memory/contracts.ts';
import type { ModelSync } from '../types.ts';
import { createCacheSync } from './CacheSync.ts';
import MemoryStore, { type MemoryStoreInstance } from './MemoryStore.ts';

interface CacheModelType {
  cache?: MemoryStoreInstance | null | unknown;
  cuid?: string;
  model_name?: string;
  prototype: {
    _orm_never_cache?: boolean;
    sync?: ModelSync;
  };
}

interface CacheOptions {
  enabled?: unknown;
  max?: unknown;
  max_age?: unknown;
  modelTypes?: Record<string, CacheOptions>;
  store?: () => unknown;
  [key: string]: unknown;
}

interface CacheInfo {
  cache: {
    reset(): unknown;
  };
  model_type: CacheModelType;
}

export interface ModelCacheInstance {
  caches: Record<string, CacheInfo>;
  enabled: unknown;
  options: CacheOptions & { modelTypes: Record<string, CacheOptions> };
  verbose: boolean;
  configure(options?: CacheOptions | null): unknown[];
  configureSync(modelType: CacheModelType, sync: ModelSync): ModelSync;
  createCache(modelType: CacheModelType): unknown;
  reset(): unknown[];
}

interface ModelCacheUnderscore {
  isObject(value: unknown): boolean;
  uniqueId(prefix: string): string;
}

let underscore: ModelCacheUnderscore | undefined;

export function installModelCacheDependencies(nextUnderscore: ModelCacheUnderscore): void {
  underscore = nextUnderscore;
}

function getUnderscore(): ModelCacheUnderscore {
  if (!underscore) throw new Error('ModelCache dependencies are not installed');
  return underscore;
}

function ModelCache(this: ModelCacheInstance): void {
  this.enabled = false;
  this.caches = {};
  this.options = { modelTypes: {} };
  this.verbose = false;
}

ModelCache.prototype.configure = function configure(this: ModelCacheInstance, options?: CacheOptions | null): unknown[] {
  const _ = getUnderscore();
  options ??= {};
  this.enabled = options.enabled;
  for (const key in options) {
    const value = options[key];
    if (_.isObject(value)) {
      this.options[key] ||= {};
      const values = this.options[key] as Record<string, unknown>;
      for (const valueKey in value as object) values[valueKey] = (value as Record<string, unknown>)[valueKey];
    } else {
      this.options[key] = value;
    }
  }
  return this.reset();
};

ModelCache.prototype.configureSync = function configureSync(this: ModelCacheInstance, modelType: CacheModelType, sync: ModelSync): ModelSync {
  if (modelType.prototype._orm_never_cache || !this.createCache(modelType)) return sync;
  return createCacheSync(modelType as unknown as MemoryModelConstructor, sync);
};

ModelCache.prototype.reset = function reset(this: ModelCacheInstance): unknown[] {
  const results: unknown[] = [];
  for (const key in this.caches) results.push(this.createCache(this.caches[key].model_type));
  return results;
};

ModelCache.prototype.createCache = function createCache(this: ModelCacheInstance, modelType: CacheModelType): unknown {
  const _ = getUnderscore();
  const modelName = modelType?.model_name;
  if (!modelName) throw new Error('Missing model name for cache');
  let cuid = modelType.cuid;
  if (!cuid) {
    cuid = _.uniqueId('cuid');
    modelType.cuid = cuid;
  }

  const cacheInfo = this.caches[cuid];
  if (cacheInfo) {
    delete this.caches[cuid];
    cacheInfo.cache.reset();
    cacheInfo.model_type.cache = null;
  }
  if (!this.enabled) return null;

  let options = this.options.modelTypes[modelName];
  if (!options) {
    if (!(this.options.store || this.options.max || this.options.max_age)) return null;
    options = this.options;
  }
  const cache = (typeof options.store === 'function' ? options.store() : undefined) || new MemoryStore(options);
  this.caches[cuid] = { cache: cache as CacheInfo['cache'], model_type: modelType };
  modelType.cache = cache;
  return cache;
};

export default ModelCache as unknown as {
  new (): ModelCacheInstance;
  (this: ModelCacheInstance): void;
  prototype: ModelCacheInstance;
};
