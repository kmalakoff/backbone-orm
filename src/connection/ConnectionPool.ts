import MemoryStore, { type MemoryStoreInstance } from '../cache/MemoryStore.ts';
import type { ConnectionDisposer, ConnectionPoolCallback, ConnectionPoolInstance } from '../types.ts';
import type { OwnedConnectionPoolState, RetainedConnectionCache } from './contracts.ts';
import { disposeAllConnectionsWorker, disposeConnectionWorker, readConnectionEntry } from './worker.ts';

const connectionPoolStateKey = Symbol.for('backbone-orm.connection-pool.owned-state');

type StatefulConnectionPool = ConnectionPoolInstance & {
  [connectionPoolStateKey]?: OwnedConnectionPoolState;
};

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function assertFunction(owner: Record<PropertyKey, unknown>, key: PropertyKey): void {
  if (typeof owner[key] !== 'function') throw new Error(`Invalid ConnectionPool: missing ${String(key)}`);
}

function assertConnectionPool(input: unknown): asserts input is StatefulConnectionPool & { cache: RetainedConnectionCache } {
  if (!isObject(input)) throw new Error('Invalid ConnectionPool: expected an object');
  for (const key of ['del', 'destroy', 'forEach', 'get', 'reset', 'set']) assertFunction(input, key);
  if (!isObject(input.cache)) throw new Error('Invalid ConnectionPool: missing cache');
  for (const key of ['del', 'forEach', 'get', 'has', 'peek', 'reset', 'set']) assertFunction(input.cache, key);
}

function asPromise(worker: (callback: ConnectionPoolCallback) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    worker((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export default function installOwnedConnectionPool(inputPool: unknown): ConnectionPoolInstance {
  assertConnectionPool(inputPool);
  const pool = inputPool;
  const publicPool: ConnectionPoolInstance = pool;
  const installed = pool[connectionPoolStateKey];
  if (installed) return pool;

  const cache = pool.cache;
  const memoryStorePool = pool as unknown as MemoryStoreInstance;
  const memoryStorePrototype = MemoryStore.prototype;
  const ownedSet = memoryStorePrototype.set.bind(memoryStorePool) as unknown as ConnectionPoolInstance['set'];
  const ownedGet = memoryStorePrototype.get.bind(memoryStorePool) as unknown as ConnectionPoolInstance['get'];
  const ownedDestroy = memoryStorePrototype.destroy.bind(memoryStorePool) as unknown as ConnectionPoolInstance['destroy'];
  const ownedReset = memoryStorePrototype.reset.bind(memoryStorePool) as unknown as ConnectionPoolInstance['reset'];
  const ownedForEach = memoryStorePrototype.forEach.bind(memoryStorePool) as unknown as ConnectionPoolInstance['forEach'];
  const state: OwnedConnectionPoolState = {
    cache,
    cacheDel: cache.del,
    cacheReset: cache.reset,
    cacheSet: cache.set,
    owned: new Map(),
    pool,
  };

  cache.set = function setWithOwnershipDetach(key, value, maxAge) {
    if (this === cache) state.owned.delete(key);
    return state.cacheSet.call(this, key, value, maxAge);
  };
  cache.del = function delWithOwnershipDetach(key) {
    if (this === cache) state.owned.delete(key);
    return state.cacheDel.call(this, key);
  };
  cache.reset = function resetWithOwnershipDetach() {
    if (this === cache) state.owned.clear();
    return state.cacheReset.call(this);
  };

  publicPool.set = ownedSet;
  publicPool.get = ownedGet;
  publicPool.destroy = ownedDestroy;
  publicPool.del = memoryStorePrototype.del as unknown as ConnectionPoolInstance['del'];
  publicPool.reset = ownedReset;
  publicPool.forEach = ownedForEach;

  pool.setOwned = function setOwned<T>(key: string, value: T, disposer: ConnectionDisposer<T>) {
    if (typeof disposer !== 'function') throw new TypeError('ConnectionPool disposer must be a function');
    const current = readConnectionEntry(state, key);
    let registration = state.owned.get(key);
    if (registration && (!current.exists || !Object.is(registration.value, current.value))) {
      state.owned.delete(key);
      registration = undefined;
    }

    if (current.exists) {
      if (!Object.is(current.value, value)) throw new Error(`ConnectionPool entry is already registered: ${key}`);
      if (registration && registration.disposer !== disposer) throw new Error(`ConnectionPool entry has a different disposer: ${key}`);
      if (!registration) state.owned.set(key, { disposer: disposer as ConnectionDisposer<unknown>, value });
      return pool;
    }

    state.cacheSet.call(cache, key, value);
    const stored = readConnectionEntry(state, key);
    if (!stored.exists || !Object.is(stored.value, value)) throw new Error(`ConnectionPool could not store owned entry: ${key}`);
    state.owned.set(key, { disposer: disposer as ConnectionDisposer<unknown>, value });
    return pool;
  };

  function dispose(key: string, callback: ConnectionPoolCallback): void;
  function dispose(key: string): Promise<void>;
  function dispose(key: string, callback?: ConnectionPoolCallback): Promise<void> | void {
    if (callback) {
      disposeConnectionWorker(state, key, callback);
      return;
    }
    return asPromise((done) => disposeConnectionWorker(state, key, done));
  }
  pool.dispose = dispose;

  function disposeAll(callback: ConnectionPoolCallback): void;
  function disposeAll(): Promise<void>;
  function disposeAll(callback?: ConnectionPoolCallback): Promise<void> | void {
    if (callback) {
      disposeAllConnectionsWorker(state, callback);
      return;
    }
    return asPromise((done) => disposeAllConnectionsWorker(state, done));
  }
  pool.disposeAll = disposeAll;

  Object.defineProperty(pool, connectionPoolStateKey, { value: state });
  return pool;
}
