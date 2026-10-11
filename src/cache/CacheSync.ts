import type Backbone from 'backbone';
import type { MemoryModelConstructor, RuntimeMemoryUtils } from '../memory/contracts.ts';
import { ownedMemoryDeletion } from '../memory/ownership.ts';
import type { BackboneORMRuntime, ModelSync } from '../types.ts';
import CacheCursor, { type CacheCursorInstance, type WrappedSync } from './CacheCursor.ts';

interface CacheStore {
  get(id: unknown): Backbone.Model | undefined;
  set(id: unknown, model: Backbone.Model): unknown;
  destroy(id: unknown): unknown;
  reset(callback?: (error?: Error | null) => unknown): unknown;
}

type CacheModelType = MemoryModelConstructor;

interface CacheSyncInstance {
  model_type: CacheModelType;
  wrapped_sync_fn: WrappedSync;
  is_initialized?: boolean;
  initialize(): unknown;
  read(model: Backbone.Model | Backbone.Collection, options: { force?: boolean; success(value?: unknown): unknown; error(error: Error): unknown }): unknown;
  create(model: Backbone.Model, options: { success(value?: unknown): unknown; error?(error: Error): unknown }): unknown;
  update(model: Backbone.Model, options: { success(value?: unknown): unknown; error?(error: Error): unknown }): unknown;
  delete(model: Backbone.Model, options: { success(value?: unknown): unknown; error(error: Error): unknown }): unknown;
  resetSchema(options: object, callback: (error?: Error | null) => unknown): unknown;
  cursor(query?: unknown): CacheCursorInstance;
  destroy(query: unknown, callback: (error?: Error | null) => unknown): unknown;
  connect(url?: string): unknown;
}

let utils: RuntimeMemoryUtils | undefined;
let runtime: BackboneORMRuntime | undefined;
const instances = new WeakMap<ModelSync, CacheSyncInstance>();

export function cacheSyncWraps(sync: ModelSync, wrapped: ModelSync): boolean {
  return instances.get(sync)?.wrapped_sync_fn === wrapped;
}
export function installCacheSyncDependencies(nextUtils: RuntimeMemoryUtils, nextRuntime: BackboneORMRuntime): void {
  utils = nextUtils;
  runtime = nextRuntime;
}

function getUtils(): RuntimeMemoryUtils {
  if (!utils) throw new Error('CacheSync dependencies are not installed');
  return utils;
}

function getCache(modelType: CacheModelType): CacheStore | undefined {
  return modelType.cache as CacheStore | undefined;
}

function CacheSync(this: CacheSyncInstance, modelType: CacheModelType, wrappedSyncFn: WrappedSync): void {
  this.model_type = modelType;
  this.wrapped_sync_fn = wrappedSyncFn;
}

CacheSync.prototype.initialize = function initialize(this: CacheSyncInstance): unknown {
  if (this.is_initialized) return;
  this.is_initialized = true;
  this.wrapped_sync_fn('initialize');
  if (!this.model_type.model_name) throw new Error('Missing model_name for model');
};
CacheSync.prototype.read = function read(this: CacheSyncInstance, model: Backbone.Model | Backbone.Collection, options: { force?: boolean; success(value?: unknown): unknown; error(error: Error): unknown }): unknown {
  const id = Reflect.get(model, 'id');
  const cached = !options.force && getCache(this.model_type)?.get(id);
  if (cached) return options.success(cached.toJSON());
  return this.wrapped_sync_fn('read', model, options);
};
CacheSync.prototype.create = function create(this: CacheSyncInstance, model: Backbone.Model, options: { success(value?: unknown): unknown; error?(error: Error): unknown }): unknown {
  return this.wrapped_sync_fn('create', model, {
    success: (json: Record<string, unknown>) => {
      model.set({ [model.idAttribute]: json[model.idAttribute] });
      const id = model.id;
      const cached = getCache(this.model_type)?.get(id);
      if (!cached) getCache(this.model_type)?.set(id, model);
      else if (cached !== model) getUtils().updateModel?.(cached, model);
      return options.success(json);
    },
    error: (error: Error) => options.error?.(error),
  });
};
CacheSync.prototype.update = function update(this: CacheSyncInstance, model: Backbone.Model, options: { success(value?: unknown): unknown; error?(error: Error): unknown }): unknown {
  return this.wrapped_sync_fn('update', model, {
    success: (json: unknown) => {
      const cached = getCache(this.model_type)?.get(model.id);
      if (!cached) getCache(this.model_type)?.set(model.id, model);
      else if (cached !== model) {
        const JSONModel = getUtils().get(this.model_type, 'model_type_json');
        if (typeof JSONModel === 'function' && model.constructor === JSONModel && json && typeof json === 'object' && !Array.isArray(json)) {
          if (!Reflect.get(model, '_orm_needs_load')) getUtils().updateModel?.(cached, model.clone().set(json));
        } else getUtils().updateModel?.(cached, model);
      }
      return options.success(json);
    },
    error: (error: Error) => options.error?.(error),
  });
};
CacheSync.prototype.delete = function deleteModel(this: CacheSyncInstance, model: Backbone.Model, options: { success(value?: unknown): unknown; error(error: Error): unknown }): unknown {
  if (!runtime || !ownedMemoryDeletion(runtime, this.model_type, this.wrapped_sync_fn)) {
    getCache(this.model_type)?.destroy(model.id);
    return this.wrapped_sync_fn('delete', model, options);
  }
  const cache = getCache(this.model_type);
  const id = model.id;
  const cached = cache?.get(id);
  let completed = false;
  return this.wrapped_sync_fn('delete', model, {
    ...options,
    success: (...values: unknown[]) => {
      if (completed) return;
      completed = true;
      if (cached && getCache(this.model_type) === cache && cache?.get(id) === cached) cache.destroy(id);
      return Reflect.apply(options.success, options, values);
    },
    error: (error: Error) => {
      if (completed) return;
      completed = true;
      return options.error(error);
    },
  });
};
CacheSync.prototype.resetSchema = function resetSchema(this: CacheSyncInstance, options: object, callback: (error?: Error | null) => unknown): unknown {
  return getCache(this.model_type)?.reset((error) => (error ? callback(error) : this.wrapped_sync_fn('resetSchema', options, callback)));
};
CacheSync.prototype.cursor = function cursor(this: CacheSyncInstance, query: unknown = {}): CacheCursorInstance {
  return new CacheCursor(query, { model_type: this.model_type, wrapped_sync_fn: this.wrapped_sync_fn });
};
CacheSync.prototype.destroy = function destroy(this: CacheSyncInstance, query: unknown, callback: (error?: Error | null) => unknown): unknown {
  const owner = runtime && ownedMemoryDeletion(runtime, this.model_type, this.wrapped_sync_fn);
  if (owner) {
    return owner.destroy(query, callback, (rows) => {
      const cache = getCache(this.model_type);
      const entries = new Map(rows.map(({ row, id }) => [row, { id, cached: cache?.get(id) }]));
      return (row) => {
        const captured = entries.get(row);
        if (captured?.cached && getCache(this.model_type) === cache && cache?.get(captured.id) === captured.cached) cache.destroy(captured.id);
      };
    });
  }
  return this.model_type.each?.({ $each: { limit: 1000, threads: 100 }, ...(query as object) }, (model: Backbone.Model, next: (error?: Error | null) => unknown) => (model as unknown as { destroy(callback: (error?: Error | null) => unknown): unknown }).destroy(next), callback);
};
CacheSync.prototype.connect = function connect(this: CacheSyncInstance): unknown {
  getCache(this.model_type)?.reset();
  return this.wrapped_sync_fn('connect');
};

export function createCacheSync(modelType: CacheModelType, wrappedSyncFn: ModelSync): ModelSync {
  const CacheSyncConstructor = CacheSync as unknown as new (nextModelType: CacheModelType, nextWrappedSyncFn: WrappedSync) => CacheSyncInstance;
  const sync = new CacheSyncConstructor(modelType, wrappedSyncFn as WrappedSync);
  const syncFunction = function cacheSync(method: string, ...arguments_: unknown[]): unknown {
    sync.initialize();
    const forwardedArguments = [method, ...arguments_];
    if (method === 'createSync') return Reflect.apply(wrappedSyncFn, null, forwardedArguments);
    if (method === 'sync') return sync;
    const implementation = Reflect.get(sync, method);
    if (implementation) return Reflect.apply(implementation as (...arguments_: unknown[]) => unknown, sync, arguments_);
    return Reflect.apply(wrappedSyncFn, wrappedSyncFn, forwardedArguments);
  } as ModelSync;
  instances.set(syncFunction, sync);
  modelType.prototype.sync = syncFunction;
  return syncFunction;
}

export default CacheSync as unknown as {
  new (modelType: CacheModelType, wrappedSyncFn: WrappedSync): CacheSyncInstance;
  (this: CacheSyncInstance, modelType: CacheModelType, wrappedSyncFn: WrappedSync): void;
  prototype: CacheSyncInstance;
};
