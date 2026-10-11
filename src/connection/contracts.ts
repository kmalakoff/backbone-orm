import type { ConnectionDisposer, ConnectionPoolInstance } from '../types.ts';

export interface RetainedConnectionCache {
  del(key: unknown): unknown;
  forEach(callback: (value: unknown, key: unknown, cache: RetainedConnectionCache) => unknown): unknown;
  get(key: unknown): unknown;
  has(key: unknown): boolean;
  peek(key: unknown): unknown;
  reset(): unknown;
  set(key: unknown, value: unknown, maxAge?: unknown): unknown;
}

export interface ActiveDisposal {
  callbacks: Array<(error?: Error | null) => void>;
}

export interface OwnedRegistration {
  active?: ActiveDisposal;
  disposer: ConnectionDisposer<unknown>;
  value: unknown;
}

export interface OwnedConnectionPoolState {
  cache: RetainedConnectionCache;
  cacheDel: RetainedConnectionCache['del'];
  cacheReset: RetainedConnectionCache['reset'];
  cacheSet: RetainedConnectionCache['set'];
  owned: Map<unknown, OwnedRegistration>;
  pool: ConnectionPoolInstance;
}

export interface ConnectionEntry {
  exists: boolean;
  value: unknown;
}
