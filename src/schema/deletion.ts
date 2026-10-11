import type { ErrorCallback, ModelJSON, RelationalModel, RelationalModelConstructor } from './contracts.ts';
import { getSchemaDependencies } from './runtime.ts';

export const deletionCleanupKey = Symbol.for('backbone-orm.schema.deletion-cleanup');
export const deletionPreflightKey = Symbol.for('backbone-orm.schema.deletion-preflight');

export interface DeletionContext {
  readonly modelType: RelationalModelConstructor;
  readonly idAttribute: string;
  readonly id: unknown;
  readonly row: ModelJSON;
  readonly store: ModelJSON[];
  readonly storeOwner: { readonly store: ModelJSON[] };
}

export function deletionConflict(context: DeletionContext): Error {
  return new Error(`Deletion conflict. Type: ${context.modelType.model_name}. Id: ${String(context.id)}. Stored row changed or disappeared during cleanup.`);
}

export function ownsDeletionRow(context: DeletionContext): boolean {
  return deletionRowIndex(context) >= 0;
}

export function deletionRowIndex(context: DeletionContext): number {
  if (context.storeOwner.store !== context.store) return -1;
  const index = context.store.findIndex((row) => row[context.idAttribute] === context.id);
  return index >= 0 && context.store[index] === context.row ? index : -1;
}

export function cacheClearedRelationModel(model: RelationalModel, modelType: RelationalModelConstructor, context?: DeletionContext): unknown {
  if (context && modelType === context.modelType && model.id === context.id) return;
  return model.cache()?.set(model.id, model);
}

export function saveClearedRelationRow(json: ModelJSON, modelType: RelationalModelConstructor, callback: ErrorCallback, context?: DeletionContext): unknown {
  if (context && modelType === context.modelType && json[context.idAttribute] === context.id) {
    return callback(ownsDeletionRow(context) ? undefined : deletionConflict(context));
  }
  return getSchemaDependencies().Utils.modelJSONSave(json, modelType, callback);
}
