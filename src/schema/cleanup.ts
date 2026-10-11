import type { ErrorCallback, ModelJSON, RelationalModel, RelationalModelConstructor, RelationCleanup, RelationContract, SchemaDependencies } from './contracts.ts';
import { type DeletionContext, deletionCleanupKey, deletionPreflightKey } from './deletion.ts';

interface DeletionRelation {
  [deletionCleanupKey](model: RelationalModel | ModelJSON, callback: ErrorCallback, context: DeletionContext): unknown;
  [deletionPreflightKey](): boolean;
}

function unsupportedDeletionRelation(modelType: RelationalModelConstructor, relations: RelationContract[]): Error | undefined {
  for (const relation of relations) {
    const preflight = Reflect.get(relation, deletionPreflightKey);
    if (typeof preflight !== 'function' || !Reflect.apply(preflight, relation, [])) {
      return new Error(`Unsupported relation.patchRemove override for owned deletion. Type: ${modelType.model_name}. Relation: ${relation.key}.`);
    }
  }
}

export function preflightRelationDeletion(modelType: RelationalModelConstructor): Error | undefined {
  return unsupportedDeletionRelation(modelType, Object.values(modelType.schema()?.relations ?? {}));
}

export default function createRelationCleanup({ Queue }: Pick<SchemaDependencies, 'Queue'>): RelationCleanup {
  return (modelType, model, callback, context) => {
    const schema = modelType.schema();
    if (!schema) return callback();
    const relations = Object.values(schema.relations ?? {});
    if (context) {
      const error = unsupportedDeletionRelation(modelType, relations);
      if (error) return callback(error);
    }
    const queue = new Queue(1);
    for (const relation of relations)
      queue.defer((next) => {
        let completed = false;
        const done: ErrorCallback = (error) => {
          if (completed) return;
          completed = true;
          return next(error);
        };
        if (context) return (relation as unknown as DeletionRelation)[deletionCleanupKey](model, done, context);
        return relation.patchRemove(model, done);
      });
    return queue.await(callback);
  };
}
