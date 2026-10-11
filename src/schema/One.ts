import type { ErrorCallback, ModelJSON, RelationalModel, RelationalModelConstructor, RelationCallback, RelationCursor } from './contracts.ts';
import { cacheClearedRelationModel, type DeletionContext, deletionCleanupKey, deletionPreflightKey, saveClearedRelationRow } from './deletion.ts';
import Relation from './Relation.ts';
import { getSchemaDependencies } from './runtime.ts';

export default class One extends Relation {
  type!: 'belongsTo' | 'hasOne';

  constructor(modelType: RelationalModelConstructor, key: string, options: Record<string, unknown>) {
    super();
    const { namingConventions, underscore } = getSchemaDependencies();
    underscore.extend(this, options);
    this.model_type = modelType;
    this.key = key;
    this.virtual_id_accessor ||= namingConventions().foreignKey(this.key);
    this.join_key ||= this.foreign_key || namingConventions().foreignKey(this.model_type.model_name ?? '');
    this.foreign_key ||= namingConventions().foreignKey(this.type === 'belongsTo' ? this.key : this.as || this.model_type.model_name || '');
  }

  initialize(): void {
    this.reverse_relation = this._findOrGenerateReverseRelation();
    if (this.embed && this.reverse_relation?.embed) {
      throw new Error(`Both relationship directions cannot embed (${this.model_type.model_name} and ${this.reverse_model_type.model_name}). Choose one or the other.`);
    }
    if (this.embed) this.model_type.schema().type('id', this.reverse_model_type.schema().type('id'));
    this.reverse_model_type?.schema().type(this.foreign_key, this.model_type?.schema()?.type('id') || this.model_type);
  }

  initializeModel(model: RelationalModel): void {
    if (!model.isLoadedExists(this.key)) model.setLoaded(this.key, this.isEmbedded());
    this._bindBacklinks(model);
  }

  releaseModel(model: RelationalModel): void {
    this._unbindBacklinks(model);
    delete model._orm;
  }

  set(model: RelationalModel, key: string, input: unknown, options?: object): this {
    const { Backbone, Utils, underscore } = getSchemaDependencies();
    if (key !== this.key && key !== this.virtual_id_accessor && key !== this.foreign_key) {
      throw new Error(`One.set: Unexpected key ${key}. Expecting: ${this.key} or ${this.virtual_id_accessor} or ${this.foreign_key}`);
    }
    if (underscore.isArray(input)) throw new Error(`One.set: cannot set an array for attribute ${this.key} on ${this.model_type.model_name}`);
    let value = underscore.isUndefined(input) ? null : input;
    const previousRelatedModel = model.get(this.key) as RelationalModel | null | undefined;
    if (value === previousRelatedModel) return this;
    const isModel = Utils.isModel(value);
    const newRelatedId = Utils.dataId(value);
    const previousRelatedId = Utils.dataId(previousRelatedModel);
    Utils.orSet(model, 'rel_dirty', {})[this.key] = true;

    if (previousRelatedId !== newRelatedId || !model.isLoaded(this.key)) {
      if (isModel && (value as RelationalModel).isLoaded() && newRelatedId !== value) model.setLoaded(this.key, true);
      else model.setLoaded(this.key, underscore.isNull(value));
    }

    const mergeIntoExisting = Boolean(value && !isModel && previousRelatedId === newRelatedId);
    if (value && !isModel && !mergeIntoExisting) value = Utils.updateOrNew(value, this.reverse_model_type);
    if (!mergeIntoExisting) Reflect.apply(Backbone.Model.prototype.set, model, [this.key, value, options]);
    if (mergeIntoExisting && previousRelatedModel) Utils.updateModel(previousRelatedModel, value);
    else if (value === null && this.reverse_relation && (this.reverse_relation.type === 'hasOne' || this.reverse_relation.type === 'belongsTo') && !(this.embed || this.reverse_relation.embed)) {
      if (model.isLoaded(this.key) && previousRelatedModel && previousRelatedModel.get(this.reverse_relation.key) === model) previousRelatedModel.set(this.reverse_relation.key, null);
    }
    return this;
  }

  get(model: RelationalModel, key: string, callback?: RelationCallback<unknown>): unknown {
    if (key !== this.key && key !== this.virtual_id_accessor && key !== this.foreign_key) {
      throw new Error(`One.get: Unexpected key ${key}. Expecting: ${this.key} or ${this.virtual_id_accessor} or ${this.foreign_key}`);
    }
    const { Utils } = getSchemaDependencies();
    const returnValue = (): unknown => {
      const relatedModel = model.attributes[this.key] as RelationalModel | null | undefined;
      if (!relatedModel) return null;
      return key === this.virtual_id_accessor ? relatedModel.id : relatedModel;
    };

    const isLoaded = model.isLoaded(this.key);
    if (callback && !this.isVirtual() && !this.manual_fetch && !isLoaded) {
      this.cursor(model, key).toJSON((error, value) => {
        if (error) return callback(error);
        const json = value as ModelJSON | null;
        if (key !== this.virtual_id_accessor) model.setLoaded(this.key, true);
        const previousRelatedModel = model.get(this.key) as RelationalModel | null | undefined;
        if (previousRelatedModel && previousRelatedModel.id === json?.id) Utils.updateModel(previousRelatedModel, json);
        else model.set(this.key, json ? Utils.updateOrNew(json, this.reverse_model_type) : null);
        return callback(null, returnValue());
      });
    }

    const result = returnValue();
    if (callback && (isLoaded || this.manual_fetch)) callback(null, result);
    return result;
  }

  save(model: RelationalModel, callback: ErrorCallback): unknown {
    const { Utils } = getSchemaDependencies();
    if (!this._hasChanged(model)) return callback();
    delete Utils.orSet(model, 'rel_dirty', {})[this.key];
    const relatedModel = model.attributes[this.key] as RelationalModel | undefined;
    if (!relatedModel) return this._saveRelated(model, [], callback);
    return this._saveRelated(model, [relatedModel], callback);
  }

  patchAdd(model: RelationalModel, relatedInput: unknown, callback: ErrorCallback): unknown {
    const { Queue, Utils, underscore } = getSchemaDependencies();
    if (!model.id) return callback(new Error(`One.patchAdd: model has null id for: ${this.key}`));
    if (!relatedInput) return callback(new Error(`One.patchAdd: missing model for: ${this.key}`));
    if (underscore.isArray(relatedInput)) return callback(new Error(`One.patchAdd: should be provided with one model only for key: ${this.key}`));
    const relatedId = Utils.dataId(relatedInput);
    if (!relatedId) return callback(new Error('One.patchAdd: cannot add a new model. Please save first.'));
    let related = relatedInput;
    if (this.reverse_model_type.cache && !Utils.isModel(related)) {
      const found = this.reverse_model_type.cache.get(relatedId);
      if (found) {
        Utils.updateModel(found, related);
        related = found;
      }
    }
    model.set(this.key, related);

    if (this.type === 'belongsTo') {
      return this.model_type.cursor({ id: model.id, $one: true }).toJSON((error, value) => {
        if (error) return callback(error);
        const modelJSON = value as ModelJSON | null;
        if (!modelJSON) return callback(new Error(`Failed to fetch model with id: ${model.id}`));
        modelJSON[this.foreign_key] = relatedId;
        return Reflect.apply(model.save, model, [modelJSON, callback]);
      });
    }

    return this.cursor(model, this.key).toJSON((error, value) => {
      if (error) return callback(error);
      const currentRelatedJSON = value as ModelJSON | null;
      if (currentRelatedJSON && relatedId === currentRelatedJSON[this.reverse_model_type.prototype.idAttribute]) return callback();
      const queue = new Queue(1);
      if (currentRelatedJSON) queue.defer((next) => this.patchRemove(model, currentRelatedJSON, next));
      queue.defer((next) => {
        let relatedJSON: ModelJSON | undefined;
        if (Utils.isModel(related)) {
          if (related.isLoaded()) relatedJSON = related.toJSON() as ModelJSON;
        } else if (relatedId !== related) relatedJSON = related as ModelJSON;

        if (relatedJSON) {
          relatedJSON[this.reverse_relation?.foreign_key ?? ''] = model.id;
          return Utils.modelJSONSave(relatedJSON, this.reverse_model_type, next);
        }
        const query: ModelJSON = { $one: true, id: relatedId };
        return this.reverse_model_type.cursor(query).toJSON((fetchError, fetchedValue) => {
          if (fetchError) return next(fetchError);
          const fetched = fetchedValue as ModelJSON | null;
          if (!fetched) return next();
          fetched[this.reverse_relation?.foreign_key ?? ''] = model.id;
          return Utils.modelJSONSave(fetched, this.reverse_model_type, next);
        });
      });
      return queue.await(callback);
    });
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
    if (context ? modelId == null : !modelId) return callback(new Error(`One.patchRemove: model has null id for: ${this.key}`));

    if (removeAll) {
      if (!this.reverse_relation) return callback();
      let relatedModel: RelationalModel | undefined;
      if (Utils.isModel(model)) {
        delete Utils.orSet(model, 'rel_dirty', {})[this.key];
        relatedModel = model.get(this.key) as RelationalModel | undefined;
        model.set(this.key, null);
      } else {
        const json = model[this.key];
        if (json) relatedModel = new this.reverse_model_type(json as ModelJSON);
      }
      if (relatedModel) {
        const foreign = relatedModel.get(this.foreign_key) as RelationalModel | undefined;
        if (foreign?.id === modelId) relatedModel.set(this.foreign_key, null);
        cacheClearedRelationModel(relatedModel, this.reverse_model_type, context);
      }
      if (this.embed) return callback();
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
      const cursorModel = context && !Utils.isModel(model) ? { ...model, id: modelId } : model;
      this.cursor(cursorModel, this.key).toJSON((error, value) => {
        if (error) return callback(error);
        const relatedJSON = value as ModelJSON | null;
        if (!relatedJSON || relatedJSON[this.reverse_relation?.foreign_key ?? ''] !== modelId) return callback();
        relatedJSON[this.reverse_relation?.foreign_key ?? ''] = null;
        return saveClearedRelationRow(relatedJSON, this.reverse_model_type, callback, context);
      });
      return;
    }

    if (!relatedInput) return callback(new Error('One.patchRemove: missing model for remove'));
    const relateds = underscore.isArray(relatedInput) ? relatedInput : [relatedInput];
    const relationalModel = model as RelationalModel;
    const relatedModel = relationalModel.get(this.key) as RelationalModel | undefined;
    if (relatedModel && relateds.some((related) => Utils.dataIsSameModel(relatedModel, related))) relationalModel.set(this.key, null);
    const relatedIds = relateds.map((related) => Utils.dataId(related));
    if (this.embed) return callback();
    if (this.type === 'belongsTo') {
      return this.model_type.cursor({ id: modelId, $one: true }).toJSON((error, value) => {
        if (error) return callback(error);
        const modelJSON = value as ModelJSON | null;
        if (!modelJSON || !underscore.contains(relatedIds, modelJSON[this.foreign_key])) return callback();
        modelJSON[this.foreign_key] = null;
        return Utils.modelJSONSave(modelJSON, this.model_type, callback);
      });
    }
    return this.cursor(model, this.key).toJSON((error, value) => {
      if (error) return callback(error);
      const relatedJSON = value as ModelJSON | null;
      if (!relatedJSON || !underscore.contains(relatedIds, relatedJSON[this.reverse_model_type.prototype.idAttribute])) return callback();
      relatedJSON[this.reverse_relation?.foreign_key ?? ''] = null;
      return Utils.modelJSONSave(relatedJSON, this.reverse_model_type, callback);
    });
  }

  appendJSON(json: ModelJSON, model: RelationalModel): unknown {
    if (this.isVirtual()) return;
    const jsonKey = this.embed ? this.key : this.foreign_key;
    const relatedModel = model.attributes[this.key] as RelationalModel | undefined;
    if (!relatedModel) {
      if (this.embed || this.type === 'belongsTo') json[jsonKey] = null;
      return;
    }
    if (this.embed) {
      const value = relatedModel.toJSON();
      json[jsonKey] = value;
      return value;
    }
    if (this.type === 'belongsTo') {
      json[jsonKey] = relatedModel.id;
      return relatedModel.id;
    }
  }

  cursor(model: RelationalModel | ModelJSON, key: string, inputQuery?: ModelJSON): RelationCursor {
    const { Utils, underscore } = getSchemaDependencies();
    const query = underscore.extend({ $one: true } as ModelJSON, inputQuery ?? {});
    if (Utils.isModel(model)) {
      if (this.type === 'belongsTo') {
        const related = model.attributes[this.key] as RelationalModel | undefined;
        if (related?.id) query.id = related.id;
        else {
          query.$zero = true;
          delete query.id;
        }
      } else {
        if (!model.id) throw new Error('Cannot create cursor for non-loaded model');
        query[this.reverse_relation?.foreign_key ?? ''] = model.id;
      }
    } else if (this.type === 'belongsTo') {
      if (model[this.foreign_key]) query.id = model[this.foreign_key];
      else {
        query.$zero = true;
        delete query.id;
      }
    } else {
      if (!model.id) throw new Error('Cannot create cursor for non-loaded model');
      query[this.reverse_relation?.foreign_key ?? ''] = model.id;
    }
    if (key === this.virtual_id_accessor) query.$values = ['id'];
    return this.reverse_model_type.cursor(query);
  }

  _bindBacklinks(model: RelationalModel): RelationalModel | undefined {
    if (!this.reverse_relation) return;
    const { Utils } = getSchemaDependencies();
    const events = Utils.set(model, 'events', {});
    const setBacklink = (relatedModel: RelationalModel): unknown => {
      if (this.reverse_relation?.add) return this.reverse_relation.add(relatedModel, model);
      return relatedModel.set(this.reverse_relation?.key ?? '', model);
    };
    const change = (changedModel: RelationalModel): void => {
      const relatedModel = changedModel.get(this.key) as RelationalModel | undefined;
      const previousRelatedModel = changedModel.previous(this.key) as RelationalModel | undefined;
      if (Utils.dataId(relatedModel) === Utils.dataId(previousRelatedModel)) return;
      Utils.orSet(changedModel, 'rel_dirty', {})[this.key] = true;
      if (previousRelatedModel && this.reverse_relation?.type !== 'belongsTo') {
        if (this.reverse_relation?.remove) {
          if (!this.isVirtual() || !relatedModel) this.reverse_relation.remove(previousRelatedModel, changedModel);
        } else {
          const currentModel = previousRelatedModel.get(this.reverse_relation?.key ?? '');
          if (Utils.dataId(currentModel) === changedModel.id) previousRelatedModel.set(this.reverse_relation?.key ?? '', null);
        }
      }
      if (relatedModel) setBacklink(relatedModel);
    };
    events.change = change;
    model.on(`change:${this.key}`, change);
    const relatedModel = model.get(this.key) as RelationalModel | undefined;
    if (relatedModel) setBacklink(relatedModel);
    else model.attributes[this.key] = null;
    return model;
  }

  _unbindBacklinks(model: RelationalModel): void {
    const { Utils } = getSchemaDependencies();
    const events = Utils.get(model, 'events') as { change?: (...arguments_: unknown[]) => unknown } | undefined;
    if (!events) return;
    Utils.unset(model, 'events');
    model.attributes[this.key] = null;
    model.off(`change:${this.key}`, events.change);
    events.change = undefined;
  }

  _hasChanged(model: RelationalModel): boolean {
    const { Utils } = getSchemaDependencies();
    return Boolean(Utils.orSet(model, 'rel_dirty', {})[this.key]) || model.hasChanged(this.key);
  }
}

const ownedPatchRemove = One.prototype.patchRemove;
