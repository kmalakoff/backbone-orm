interface CacheValue {
  _orm_never_cache?: boolean;
}

interface LRUCache {
  del(key: unknown): unknown;
  forEach(callback: (value: unknown, key: unknown, cache: LRUCache) => unknown): unknown;
  get(key: unknown): unknown;
  reset(): unknown;
  set(key: unknown, value: unknown): unknown;
}

interface LRUConstructor {
  new (options: Record<string, unknown>): LRUCache;
}

interface MemoryStoreDependencies {
  LRU: LRUConstructor;
  underscore: {
    omit(value: object, key: string): Record<string, unknown>;
  };
}

export interface MemoryStoreInstance {
  cache: LRUCache;
  del(key: unknown, callback?: () => unknown): MemoryStoreInstance;
  destroy(key: unknown, callback?: () => unknown): MemoryStoreInstance;
  forEach(callback: (value: unknown, key: unknown, cache: LRUCache) => unknown): unknown;
  get(key: unknown, callback?: (error: null, value: unknown) => unknown): unknown;
  reset(callback?: () => unknown): MemoryStoreInstance;
  set(key: unknown, value: CacheValue, callback?: (error: null, value: CacheValue) => unknown): unknown;
}

let dependencies: MemoryStoreDependencies | undefined;

export function installMemoryStoreDependencies(LRU: LRUConstructor, underscore: MemoryStoreDependencies['underscore']): void {
  dependencies = { LRU, underscore };
}

function getDependencies(): MemoryStoreDependencies {
  if (!dependencies) throw new Error('MemoryStore dependencies are not installed');
  return dependencies;
}

function MemoryStore(this: MemoryStoreInstance, options?: Record<string, unknown> | null): void {
  this.forEach = this.forEach.bind(this);
  this.reset = this.reset.bind(this);
  this.destroy = this.destroy.bind(this);
  this.get = this.get.bind(this);
  this.set = this.set.bind(this);

  const { LRU, underscore } = getDependencies();
  options ??= {};
  const maxAge = options.max_age;
  if (maxAge) {
    options = underscore.omit(options, 'max_age');
    options.maxAge = maxAge;
  }
  this.cache = new LRU(options);
}

MemoryStore.prototype.set = function set(this: MemoryStoreInstance, key: unknown, value: CacheValue, callback?: (error: null, value: CacheValue) => unknown): unknown {
  if (value._orm_never_cache) return callback?.(null, value) || this;
  this.cache.set(key, value);
  callback?.(null, value);
  return this;
};

MemoryStore.prototype.get = function get(this: MemoryStoreInstance, key: unknown, callback?: (error: null, value: unknown) => unknown): unknown {
  const value = this.cache.get(key);
  callback?.(null, value);
  return value;
};

MemoryStore.prototype.destroy = function destroy(this: MemoryStoreInstance, key: unknown, callback?: () => unknown): MemoryStoreInstance {
  this.cache.del(key);
  callback?.();
  return this;
};

MemoryStore.prototype.del = MemoryStore.prototype.destroy;

MemoryStore.prototype.reset = function reset(this: MemoryStoreInstance, callback?: () => unknown): MemoryStoreInstance {
  this.cache.reset();
  callback?.();
  return this;
};

MemoryStore.prototype.forEach = function forEach(this: MemoryStoreInstance, callback: (value: unknown, key: unknown, cache: LRUCache) => unknown): unknown {
  return this.cache.forEach(callback);
};

export default MemoryStore as unknown as {
  new (options?: Record<string, unknown> | null): MemoryStoreInstance;
  (this: MemoryStoreInstance, options?: Record<string, unknown> | null): void;
  prototype: MemoryStoreInstance;
};
