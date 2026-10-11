import type { ErrorCallback, ModelJSON, RelationalCollection, RelationalModel, RelationalModelConstructor, RelationCallback, RelationCursor } from './contracts.ts';
import { cacheClearedRelationModel, type DeletionContext, deletionCleanupKey, deletionPreflightKey, saveClearedRelationRow } from './deletion.ts';
import Relation from './Relation.ts';
import { getSchemaDependencies } from './runtime.ts';

export default class Many extends Relation {
  collection_type!: new (
    ...arguments_: never[]
  ) => RelationalCollection;
  type!: 'belongsTo' | 'hasMany';
  private readonly addingIds: Record<string, number> = {};

  constructor(modelType: RelationalModelConstructor, key: string, options: Record<string, unknown>) {
    super();
    const { Backbone, namingConventions, underscore } = getSchemaDependencies();
    underscore.extend(this, options);
    this.model_type = modelType;
    this.key = key;
    this.virtual_id_accessor ||= namingConventions().foreignKey(this.key, true);
    this.join_key ||= this.foreign_key || namingConventions().foreignKey(this.model_type.model_name ?? '');
    this.foreign_key ||= namingConventions().foreignKey(this.as || this.model_type.model_name || '');
    if (!this.collection_type) {
      class RelationCollection extends Backbone.Collection<RelationalModel> {}
      RelationCollection.prototype.model = this.reverse_model_type;
      this.collection_type = RelationCollection as unknown as new (...arguments_: never[]) => RelationalCollection;
    }
  }

  initialize(): void {
    this.reverse_relation = this._findOrGenerateReverseRelation();
    if (this.embed && this.reverse_relation?.embed) {
      throw new Error(`Both relationship directions cannot embed (${this.model_type.model_name} and ${this.reverse_model_type.model_name}). Choose one or the other.`);
    }
    if (this.reverse_relation?.type === 'hasOne') {
      throw new Error(`The reverse of a hasMany relation should be \`belongsTo\`, not \`hasOne\` (${this.model_type.model_name} and ${this.reverse_model_type.model_name}).`);
    }
    if (this.embed) this.model_type.schema().type('id', this.reverse_model_type.schema().type('id'));
    this.reverse_model_type?.schema().type(this.foreign_key, this.model_type?.schema()?.type('id') || this.model_type);
    if (this.reverse_relation?.type === 'hasMany') this.join_table = this.findOrGenerateJoinTable();
  }

  initializeModel(model: RelationalModel): void {
    if (!model.isLoadedExists(this.key)) model.setLoaded(this.key, false);
    this._bindBacklinks(model);
  }

  releaseModel(model: RelationalModel): void {
    this._unbindBacklinks(model);
    delete model._orm;
  }

  set(model: RelationalModel, key: string, input: unknown, _options?: object): this {
    const { JSONUtils, Utils, underscore } = getSchemaDependencies();
    if (key !== this.key && key !== this.virtual_id_accessor && key !== this.foreign_key) {
      throw new Error(`Many.set: Unexpected key ${key}. Expecting: ${this.key} or ${this.virtual_id_accessor} or ${this.foreign_key}`);
    }
    const collection = this._bindBacklinks(model);
    let value = input;
    if (Utils.isCollection(value)) value = (value as RelationalCollection).models;
    if (underscore.isUndefined(value)) value = [];
    if (!underscore.isArray(value)) throw new Error(`HasMany.set: Unexpected type to set ${key}. Expecting array: ${JSONUtils.stringify(value)}`);
    Utils.orSet(model, 'rel_dirty', {})[this.key] = true;
    model.setLoaded(
      this.key,
      underscore.all(value, (item) => Utils.dataId(item) !== item)
    );
    const models = value.map((item) => {
      const current = collection.get(Utils.dataId(item) as Backbone.Model | string);
      return current ? Utils.updateModel(current as RelationalModel, item) : Utils.updateOrNew(item, this.reverse_model_type);
    });
    model.setLoaded(
      this.key,
      underscore.all(models, (relatedModel) => relatedModel.isLoaded())
    );
    const previousModels = underscore.clone(collection.models);
    collection.reset(models);
    if (this.reverse_relation?.type === 'belongsTo') {
      const modelIds = underscore.pluck(models, 'id');
      for (const relatedModel of previousModels) {
        if (!underscore.contains(modelIds, relatedModel.id)) relatedModel.set(this.foreign_key, null);
      }
    }
    return this;
  }

  get(model: RelationalModel, key: string, callback?: RelationCallback<unknown>): RelationalCollection | unknown[] {
    const { Utils } = getSchemaDependencies();
    if (key !== this.key && key !== this.virtual_id_accessor && key !== this.foreign_key) {
      throw new Error(`Many.get: Unexpected key ${key}. Expecting: ${this.key} or ${this.virtual_id_accessor} or ${this.foreign_key}`);
    }
    const collection = this._ensureCollection(model);
    const returnValue = (): RelationalCollection | unknown[] => (key === this.virtual_id_accessor ? collection.models.map((relatedModel) => relatedModel.id) : collection);
    const isLoaded = model.isLoaded(this.key);
    if (callback && !this.isVirtual() && !this.manual_fetch && !isLoaded) {
      this.cursor(model, this.key).toJSON((error, value) => {
        if (error) return callback(error);
        model.setLoaded(this.key, true);
        for (const modelJSON of value as ModelJSON[]) {
          const current = collection.get(modelJSON[this.reverse_model_type.prototype.idAttribute] as Backbone.Model | string);
          if (current) current.set(modelJSON);
          else collection.add(Utils.updateOrNew(modelJSON, this.reverse_model_type));
        }
        if (this.reverse_model_type.cache) {
          for (const relatedModel of collection.models) this.reverse_model_type.cache.set(relatedModel.id, relatedModel);
        }
        const result = returnValue();
        return callback(null, result instanceof getSchemaDependencies().Backbone.Collection ? result.models : result);
      });
    }
    const result = returnValue();
    if (callback && (isLoaded || this.manual_fetch)) callback(null, result instanceof getSchemaDependencies().Backbone.Collection ? result.models : result);
    return result;
  }

  save(model: RelationalModel, callback: ErrorCallback): unknown {
    const { Utils, underscore } = getSchemaDependencies();
    if (!this._hasChanged(model)) return callback();
    delete Utils.orSet(model, 'rel_dirty', {})[this.key];
    return this._saveRelated(model, underscore.clone(this._ensureCollection(model).models), callback);
  }

  appendJSON(json: ModelJSON, model: RelationalModel): unknown {
    if (this.isVirtual()) return;
    const collection = this._ensureCollection(model);
    const jsonKey = this.embed ? this.key : this.virtual_id_accessor;
    if (this.embed) {
      const value = collection.toJSON();
      json[jsonKey] = value;
      return value;
    }
  }

  add(model: RelationalModel, relatedModel: RelationalModel): unknown {
    const id = relatedModel.id;
    let addingCount = 0;
    if (id) addingCount = this.addingIds[String(id)] = (this.addingIds[String(id)] ?? 0) + 1;
    const collection = this._ensureCollection(model);
    const current = collection.get(id) as RelationalModel | undefined;
    if (current === relatedModel) return;
    if (current) collection.remove(current);
    if (this.reverse_model_type.cache && id) this.reverse_model_type.cache.set(id, relatedModel);
    const result = collection.add(relatedModel, { silent: addingCount > 1 });
    if (id) this.addingIds[String(id)] -= 1;
    return result;
  }

  remove(model: RelationalModel, relatedModel: RelationalModel): unknown {
    const { Utils } = getSchemaDependencies();
    const collection = this._ensureCollection(model);
    const current = collection.get(relatedModel.id) as RelationalModel | undefined;
    if (!current) return;
    Utils.orSet(model, 'rel_dirty', {})[this.key] = true;
    return collection.remove(current);
  }

  patchAdd(model: RelationalModel, relatedInput: unknown, callback: ErrorCallback): unknown {
    const { Utils, underscore } = getSchemaDependencies();
    if (!model.id) return callback(new Error(`Many.patchAdd: model has null id for: ${this.key}`));
    if (!relatedInput) return callback(new Error(`Many.patchAdd: missing model for: ${this.key}`));
    const collection = this._ensureCollection(model);
    const inputs = underscore.isArray(relatedInput) ? relatedInput : [relatedInput];
    const relateds = inputs.map((item) => {
      const current = collection.get(Utils.dataId(item) as Backbone.Model | string);
      return current ? Utils.updateModel(current as RelationalModel, item) : Utils.updateOrNew(item, this.reverse_model_type);
    });
    const relatedIds = relateds.map((related) => Utils.dataId(related));
    collection.add(relateds);
    if (model.isLoaded(this.key) && relateds.some((related) => !related.isLoaded())) model.setLoaded(this.key, false);

    if (this.join_table) {
      const joinTable = this.join_table;
      return Utils.each(
        relatedIds,
        (relatedId, next) => {
          if (!relatedId) return next(new Error('Many.patchAdd: cannot add an new model. Please save first.'));
          const add = (done: ErrorCallback): unknown => {
            const attributes: ModelJSON = { [this.foreign_key]: model.id, [this.reverse_relation?.foreign_key ?? '']: relatedId };
            return joinTable.exists(attributes, (error, exists) => {
              if (error) return done(error);
              if (exists) return done(new Error(`Join already exists: ${JSON.stringify(attributes)}`));
              return new joinTable(attributes).save(done);
            });
          };
          if (this.reverse_relation?.type === 'hasMany') return add(next);
          const query: ModelJSON = { $one: true, [this.reverse_relation?.foreign_key ?? '']: relatedId };
          return joinTable.cursor(query).toJSON((error, value) => {
            if (error) return next(error);
            const joinJSON = value as ModelJSON | null;
            if (!joinJSON) return add(next);
            if (joinJSON[this.foreign_key] === model.id) return next();
            joinJSON[this.foreign_key] = model.id;
            return Utils.modelJSONSave(joinJSON, joinTable, next);
          });
        },
        callback
      );
    }

    const query: ModelJSON = { id: { $in: relatedIds } };
    return this.reverse_model_type.cursor(query).toJSON((_error, value) =>
      Utils.each(
        value as ModelJSON[],
        (relatedJSON, next) => {
          relatedJSON[this.reverse_relation?.foreign_key ?? ''] = model.id;
          return Utils.modelJSONSave(relatedJSON, this.reverse_model_type, next);
        },
        callback
      )
    );
  }

  patchRemove(model: RelationalModel | ModelJSON, callback: ErrorCallback): unknown;
  patchRemove(model: RelationalModel, related: unknown, callback: ErrorCallback): unknown;
  patchRemove(model: RelationalModel | ModelJSON, relatedOrCallback: unknown | ErrorCallback, maybeCallback?: ErrorCallback): unknown {
    // biome-ignore lint/complexity/noArguments: Legacy relation removal distinguishes its callback overload by argument count.
    const removeAll = arguments.length === 2;
    const callback = (removeAll ? relatedOrCallback : maybeCallback) as ErrorCallback;
    const relatedInput = removeAll ? null : relatedOrCallback;
    return this.removeRelated(model, removeAll, relatedInput, callback);
  }

  [deletionCleanupKey](model: RelationalModel | ModelJSON, callback: ErrorCallback, context: DeletionContext): unknown {
    return this.removeRelated(model, true, null, callback, context);
  }

  [deletionPreflightKey](): boolean {
    return this.patchRemove === ownedPatchRemove;
  }

  private removeRelated(model: RelationalModel | ModelJSON, removeAll: boolean, relatedInput: unknown, callback: ErrorCallback, context?: DeletionContext): unknown {
    const { Utils, underscore } = getSchemaDependencies();
    const modelId = context ? context.id : model.id;
    if (context ? modelId == null : !modelId) return callback(new Error(`Many.patchRemove: model has null id for: ${this.key}`));

    if (removeAll) {
      if (!this.reverse_relation) return callback();
      let relatedModels: RelationalModel[];
      if (Utils.isModel(model)) {
        delete Utils.orSet(model, 'rel_dirty', {})[this.key];
        relatedModels = underscore.clone(this._ensureCollection(model).models);
      } else {
        relatedModels = ((model[this.key] as ModelJSON[] | undefined) ?? []).map((json) => new this.reverse_model_type(json));
      }
      for (const relatedModel of relatedModels) {
        const foreign = relatedModel.get(this.foreign_key) as RelationalModel | undefined;
        if (foreign?.id === modelId) relatedModel.set(this.foreign_key, null);
        cacheClearedRelationModel(relatedModel, this.reverse_model_type, context);
      }
      if (this.embed) return callback();
      if (this.join_table) return this.join_table.destroy({ [this.join_key]: modelId }, callback);
      if (this.type === 'belongsTo') {
        this.model_type.cursor({ [context ? context.idAttribute : 'id']: modelId, $one: true }).toJSON((error, value) => {
          if (error) return callback(error);
          const modelJSON = value as ModelJSON | null;
          if (!modelJSON) return callback();
          modelJSON[this.foreign_key] = null;
          return saveClearedRelationRow(modelJSON, this.model_type, callback, context);
        });
        return;
      }
      this.reverse_model_type.cursor({ [this.reverse_relation.foreign_key]: modelId }).toJSON((error, value) => {
        if (error) return callback(error);
        return Utils.each(
          value as ModelJSON[],
          (relatedJSON, next) => {
            relatedJSON[this.reverse_relation?.foreign_key ?? ''] = null;
            return saveClearedRelationRow(relatedJSON, this.reverse_model_type, next, context);
          },
          callback
        );
      });
      return;
    }

    if (!relatedInput) return callback(new Error('Many.patchRemove: missing model for remove'));
    const relateds = underscore.isArray(relatedInput) ? relatedInput : [relatedInput];
    const collection = this._ensureCollection(model as RelationalModel);
    for (const related of relateds) {
      const current = collection.models.find((candidate) => Utils.dataIsSameModel(candidate, related));
      if (current) collection.remove(current);
    }
    const relatedIds = relateds.map((related) => Utils.dataId(related));
    if (this.embed) return callback();
    if (this.join_table) {
      return this.join_table.destroy({ [this.join_key]: modelId, [this.reverse_relation?.join_key ?? '']: { $in: relatedIds } }, callback);
    }
    if (this.type === 'belongsTo') {
      return this.model_type.cursor({ id: modelId, $one: true }).toJSON((error, value) => {
        if (error) return callback(error);
        const modelJSON = value as ModelJSON | null;
        if (!modelJSON || !underscore.contains(relatedIds, modelJSON[this.foreign_key])) return callback();
        modelJSON[this.foreign_key] = null;
        return Utils.modelJSONSave(modelJSON, this.model_type, callback);
      });
    }
    const query: ModelJSON = { [this.reverse_relation?.foreign_key ?? '']: modelId, id: { $in: relatedIds } };
    return this.reverse_model_type.cursor(query).toJSON((error, value) => {
      if (error) return callback(error);
      return Utils.each(
        value as ModelJSON[],
        (relatedJSON, next) => {
          if (relatedJSON[this.reverse_relation?.foreign_key ?? ''] !== modelId) return next();
          relatedJSON[this.reverse_relation?.foreign_key ?? ''] = null;
          return Utils.modelJSONSave(relatedJSON, this.reverse_model_type, next);
        },
        callback
      );
    });
  }

  cursor(model: RelationalModel | ModelJSON, key: string, inputQuery?: ModelJSON): RelationCursor {
    const { Utils, underscore } = getSchemaDependencies();
    const json = Utils.isModel(model) ? (model.attributes as ModelJSON) : model;
    const query = underscore.clone(inputQuery || {});
    query[this.join_table ? this.join_key : (this.reverse_relation?.foreign_key ?? '')] = json[this.model_type.prototype.idAttribute];
    if (key === this.virtual_id_accessor) {
      const values = (query.$values as string[] | undefined) || [];
      query.$values = values;
      values.push('id');
    }
    return this.reverse_model_type.cursor(query);
  }

  _bindBacklinks(model: RelationalModel): RelationalCollection {
    const existing = model.attributes[this.key];
    if (existing instanceof this.collection_type) return existing;
    const collection = new this.collection_type();
    model.attributes[this.key] = collection;
    if (!this.reverse_relation) return collection;
    const { Utils, underscore } = getSchemaDependencies();
    const events = Utils.set(collection, 'events', {});
    const add = (relatedModel: RelationalModel): unknown => {
      if (this.reverse_relation?.add) return this.reverse_relation.add(relatedModel, model);
      const currentModel = relatedModel.get(this.reverse_relation?.key ?? '') as RelationalModel | undefined;
      const isCurrent = Boolean(model.id && Utils.dataId(currentModel) === model.id);
      if (!isCurrent || (isCurrent && !currentModel?.isLoaded())) return relatedModel.set(this.reverse_relation?.key ?? '', model);
    };
    const remove = (relatedModel: RelationalModel): unknown => {
      Utils.orSet(model, 'rel_dirty', {})[this.key] = true;
      if (this.reverse_relation?.remove) return this.reverse_relation.remove(relatedModel, model);
      const currentModel = relatedModel.get(this.reverse_relation?.key ?? '');
      if (Utils.dataId(currentModel) === model.id) return relatedModel.set(this.reverse_relation?.key ?? '', null);
    };
    const reset = (currentCollection: RelationalCollection, options: { previousModels?: RelationalModel[] }): void => {
      Utils.orSet(model, 'rel_dirty', {})[this.key] = true;
      const currentModels = currentCollection.models;
      const previousModels = options.previousModels ?? [];
      const changes = underscore.groupBy(previousModels, (candidate) => (underscore.find(currentModels, (current) => current.id === candidate.id) ? 'kept' : 'removed'));
      const added = changes.kept ? underscore.select(currentModels, (candidate) => !underscore.find(changes.kept, (kept) => kept.id === candidate.id)) : currentModels;
      if (changes.removed) for (const relatedModel of changes.removed) remove(relatedModel);
      for (const relatedModel of added) add(relatedModel);
    };
    events.add = add;
    events.remove = remove;
    events.reset = reset;
    collection.on('add', add);
    collection.on('remove', remove);
    collection.on('reset', reset);
    return collection;
  }

  _unbindBacklinks(model: RelationalModel): void {
    const { Utils } = getSchemaDependencies();
    const events = Utils.get(model, 'events') as Record<string, ((...arguments_: unknown[]) => unknown) | undefined> | undefined;
    if (!events) return;
    Utils.unset(model, 'events');
    const collection = model.attributes[this.key] as RelationalCollection;
    collection.models.splice(0);
    for (const method of ['add', 'remove', 'reset']) {
      collection.off(method, events[method]);
      events[method] = undefined;
    }
  }

  _ensureCollection(model: RelationalModel): RelationalCollection {
    return this._bindBacklinks(model);
  }

  _hasChanged(model: RelationalModel): boolean {
    const { Utils } = getSchemaDependencies();
    return Boolean(Utils.orSet(model, 'rel_dirty', {})[this.key]) || model.hasChanged(this.key);
  }
}

const ownedPatchRemove = Many.prototype.patchRemove;
