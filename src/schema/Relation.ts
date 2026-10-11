import type { ErrorCallback, ModelJSON, RelationalModel, RelationalModelConstructor, RelationContract } from './contracts.ts';
import { getSchemaDependencies } from './runtime.ts';

export default abstract class Relation implements RelationContract {
  as?: string;
  embed?: boolean;
  foreign_key!: string;
  join_key!: string;
  join_table?: RelationalModelConstructor;
  key!: string;
  manual_fetch?: boolean;
  model_type!: RelationalModelConstructor;
  reverse_model_type!: RelationalModelConstructor;
  reverse_relation?: RelationContract;
  abstract type: 'belongsTo' | 'hasMany' | 'hasOne';
  virtual?: boolean;
  virtual_id_accessor!: string;

  abstract cursor(model: RelationalModel | ModelJSON, key: string, query?: ModelJSON): ReturnType<RelationalModelConstructor['cursor']>;
  abstract initialize(): void;
  abstract patchAdd(model: RelationalModel, related: unknown, callback: ErrorCallback): unknown;
  abstract patchRemove(model: RelationalModel | ModelJSON, callback: ErrorCallback): unknown;
  abstract patchRemove(model: RelationalModel, related: unknown, callback: ErrorCallback): unknown;
  abstract _hasChanged(model: RelationalModel): boolean;

  isEmbedded(): boolean {
    return Boolean(this.embed || this.reverse_relation?.embed);
  }

  isVirtual(): boolean {
    return Boolean(this.virtual || this.reverse_relation?.virtual);
  }

  findOrGenerateJoinTable(): RelationalModelConstructor {
    const joinTable = this.join_table || this.reverse_relation?.join_table;
    return joinTable || this.model_type.schema().generateJoinTable(this);
  }

  _findOrGenerateReverseRelation(): RelationContract | undefined {
    const { namingConventions, underscore } = getSchemaDependencies();
    const modelType = this.model_type;
    const reverseModelType = this.reverse_model_type;
    if (!underscore.isFunction(reverseModelType.schema)) reverseModelType.sync = modelType.createSync(reverseModelType);

    let reverseRelation = reverseModelType.relation(this.as as string);
    if (!reverseRelation) reverseRelation = reverseModelType.relation(namingConventions().attribute(modelType.model_name ?? '', false));
    if (!reverseRelation) reverseRelation = reverseModelType.relation(namingConventions().attribute(modelType.model_name ?? '', true));
    if (!reverseRelation && this.type !== 'belongsTo') reverseRelation = reverseModelType.schema().generateBelongsTo(modelType);
    if (reverseRelation && !reverseRelation.reverse_relation) reverseRelation.reverse_relation = this;
    return reverseRelation;
  }

  _saveRelated(model: RelationalModel, relatedModels: RelationalModel[], callback: ErrorCallback): unknown {
    const { Queue, Utils, underscore } = getSchemaDependencies();
    if (this.embed || !this.reverse_relation || this.type === 'belongsTo') return callback();
    if (this.isVirtual()) return callback();

    return this.cursor(model, this.key).toJSON((error, value) => {
      if (error) return callback(error);
      const json = (underscore.isArray(value) ? value : value ? [value] : []) as ModelJSON[];
      const queue = new Queue(1);
      const relatedIds = underscore.pluck(relatedModels, 'id');
      const changes = underscore.groupBy(json, (entry) => (underscore.contains(relatedIds, entry.id) ? 'kept' : 'removed'));
      const addedIds = changes.kept
        ? underscore.difference(
            relatedIds,
            changes.kept.map((entry) => entry.id)
          )
        : relatedIds;

      if (changes.removed) {
        if (this.join_table) {
          queue.defer((next) => {
            const query: ModelJSON = { [this.join_key]: model.id };
            query[this.reverse_relation?.join_key ?? ''] = { $in: changes.removed.map((entry) => entry[this.reverse_model_type.prototype.idAttribute]) };
            return this.join_table?.destroy(query, next);
          });
        } else {
          queue.defer((next) =>
            Utils.each(
              changes.removed,
              (relatedJSON, done) => {
                relatedJSON[this.reverse_relation?.foreign_key ?? ''] = null;
                return Utils.modelJSONSave(relatedJSON, this.reverse_model_type, done);
              },
              next
            )
          );
        }
      }

      if (addedIds.length) {
        if (this.join_table) {
          const joinTable = this.join_table;
          queue.defer((next) =>
            Utils.each(
              addedIds,
              (relatedId, done) => {
                const attributes: ModelJSON = { [this.foreign_key]: model.id, [this.reverse_relation?.foreign_key ?? '']: relatedId };
                return new joinTable(attributes).save(done);
              },
              next
            )
          );
        } else {
          queue.defer((next) =>
            Utils.each(
              addedIds,
              (addedId, done) => {
                const relatedModel = underscore.find(relatedModels, (candidate) => candidate.id === addedId);
                if (!relatedModel || !this.reverse_relation?._hasChanged(relatedModel)) return done();
                return relatedModel.save((saveError: Error | null, savedModel: RelationalModel) => {
                  if (!saveError) this.reverse_model_type.cache?.set(savedModel.id, savedModel);
                  return done(saveError);
                });
              },
              next
            )
          );
        }
      }
      return queue.await(callback);
    });
  }
}
