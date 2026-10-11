import type { BackboneORMRuntime } from '../types.ts';
import type { ErrorCallback, ModelJSON } from './contracts.ts';

export const memorySyncStateKey = Symbol.for('backbone-orm.memory-sync.owned-state');

interface MemoryDeletionOwnership {
  owners: WeakMap<object, object>;
  completedDeletionSyncs?: WeakSet<object>;
  deletionWorkers?: WeakMap<object, OwnedMemoryDeletion>;
  currentDeletionSyncs?: WeakMap<object, () => boolean>;
}

export interface OwnedMemoryDeletion {
  preflight(): Error | undefined;
  destroy(query: unknown, callback: ErrorCallback, acquired: DeletionBatchAcquired): unknown;
}

export type DeletionBatchAcquired = (rows: ReadonlyArray<{ row: ModelJSON; id: unknown }>) => (row: ModelJSON, id: unknown) => unknown;

export function ownedMemoryDeletion(runtime: BackboneORMRuntime, modelType: object, currentSync: unknown): OwnedMemoryDeletion | undefined {
  if (!ownsCompletedMemoryDeletion(runtime, modelType, currentSync)) return;
  const state = Reflect.get(runtime, memorySyncStateKey) as MemoryDeletionOwnership;
  return state.deletionWorkers?.get(currentSync as object);
}

export function ownsCompletedMemoryDeletion(runtime: BackboneORMRuntime, modelType: object, currentSync: unknown): boolean {
  if (typeof currentSync !== 'function') return false;
  const state = Reflect.get(runtime, memorySyncStateKey) as MemoryDeletionOwnership | undefined;
  return state?.owners.get(currentSync) === modelType && state.completedDeletionSyncs?.has(currentSync) === true && state.currentDeletionSyncs?.get(currentSync)?.() === true;
}
