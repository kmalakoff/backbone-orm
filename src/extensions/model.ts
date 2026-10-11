// biome-ignore-all lint/complexity/noArguments: Published overloads and original-method forwarding depend on exact argument counts.

import { ownedMemoryDeletion } from '../memory/ownership.ts';
import type { BackboneORMRuntime } from '../types.ts';
import installCollectionExtensions from './collection.ts';
import type { ExtensionCallback, ExtensionModel, ExtensionModelConstructor, ExtensionRelation, ExtensionSchema, ExtensionUnderscore } from './contracts.ts';
import modelEach from './modelEach.ts';
import modelInterval from './modelInterval.ts';
import createModelStream from './modelStream.ts';

type Options = Record<string, unknown> & {
  error?: (...arguments_: unknown[]) => unknown;
  keys?: string[];
  success?: (...arguments_: unknown[]) => unknown;
  _cache?: Record<string, Record<PropertyKey, ExtensionModel>>;
};

type OriginalFunction = (this: ExtensionModel, ...arguments_: never[]) => unknown;

function _asCallback(value: unknown): ExtensionCallback {
  return value as ExtensionCallback;
}

export default function installModelExtensions(runtime: BackboneORMRuntime, modelType: ExtensionModelConstructor): unknown {
  const underscore = runtime._ as ExtensionUnderscore;
  const ModelStream = createModelStream(runtime);
  installCollectionExtensions(runtime);

  modelType.createSync = (targetModelType) => modelType.prototype.sync('createSync', targetModelType) as never;
  modelType.resetSchema = function resetSchema(options: object | ExtensionCallback, callback?: ExtensionCallback): unknown {
    const finalOptions = arguments.length === 1 ? {} : options;
    const finalCallback = arguments.length === 1 ? options : callback;
    return modelType.prototype.sync('resetSchema', finalOptions, finalCallback) as never;
  };
  modelType.cursor = (query?: unknown) => modelType.prototype.sync('cursor', query ?? {}) as never;
  modelType.destroy = function destroy(query: unknown | ExtensionCallback, callback?: ExtensionCallback): unknown {
    let finalQuery = arguments.length === 1 ? {} : query;
    const finalCallback = arguments.length === 1 ? query : callback;
    if (!underscore.isObject(finalQuery)) finalQuery = { id: finalQuery };
    return modelType.prototype.sync('destroy', finalQuery, finalCallback) as never;
  };
  modelType.db = () => modelType.prototype.sync('db') as never;
  modelType.exists = function exists(query: unknown | ExtensionCallback, callback?: ExtensionCallback<boolean>): unknown {
    const finalQuery = arguments.length === 1 ? {} : query;
    const finalCallback = (arguments.length === 1 ? query : callback) as ExtensionCallback<boolean>;
    return modelType.cursor(finalQuery).exists(finalCallback);
  };
  modelType.count = function count(query: unknown | ExtensionCallback<number>, callback?: ExtensionCallback<number>): unknown {
    const finalQuery = arguments.length === 1 ? {} : query;
    const finalCallback = (arguments.length === 1 ? query : callback) as ExtensionCallback<number>;
    return modelType.cursor(finalQuery).count(finalCallback);
  };
  modelType.all = (callback) => modelType.cursor({}).toModels(callback as ExtensionCallback<ExtensionModel[] | ExtensionModel | null>);
  modelType.find = function find(query: unknown | ExtensionCallback<ExtensionModel[]>, callback?: ExtensionCallback<ExtensionModel[]>): unknown {
    const finalQuery = arguments.length === 1 ? {} : query;
    const finalCallback = (arguments.length === 1 ? query : callback) as ExtensionCallback<ExtensionModel[]>;
    return modelType.cursor(finalQuery).toModels(finalCallback as ExtensionCallback<ExtensionModel[] | ExtensionModel | null>);
  };
  modelType.findOne = function findOne(query: unknown | ExtensionCallback<ExtensionModel | null>, callback?: ExtensionCallback<ExtensionModel | null>): unknown {
    const finalCallback = (arguments.length === 1 ? query : callback) as ExtensionCallback<ExtensionModel | null>;
    const input = arguments.length === 1 ? {} : query;
    const finalQuery = underscore.isObject(input) ? underscore.extend({ $one: true }, input as object) : { id: input, $one: true };
    return modelType.cursor(finalQuery).toModels(finalCallback as ExtensionCallback<ExtensionModel[] | ExtensionModel | null>);
  };
  modelType.findOrCreate = (data, callback) => {
    if (!underscore.isObject(data) || runtime.Utils.isModel(data) || runtime.Utils.isCollection(data)) throw 'findOrCreate requires object data';
    const query = underscore.extend({ $one: true }, data);
    return modelType.cursor(query).toModels((error, value) => {
      if (error) return callback(error);
      const model = value as ExtensionModel | null | undefined;
      if (model) return callback(null, model);
      const created = new modelType(data);
      return Reflect.apply(created.save, created, [callback]);
    });
  };
  modelType.findOneNearestDate = function findOneNearestDate(date: Date, options: Record<string, unknown>, query: Record<string, unknown> | ExtensionCallback<ExtensionModel | null>, callback?: ExtensionCallback<ExtensionModel | null>): unknown {
    const key = options.key as string | undefined;
    if (!key) throw new Error('Missing options key');
    let finalOptions = options;
    let finalQuery: Record<string, unknown>;
    let finalCallback: ExtensionCallback<ExtensionModel | null>;
    if (arguments.length === 2) {
      finalQuery = {};
      finalCallback = query as ExtensionCallback<ExtensionModel | null>;
    } else if (arguments.length === 3) {
      finalOptions = new Date() as unknown as Record<string, unknown>;
      finalQuery = {};
      finalCallback = query as ExtensionCallback<ExtensionModel | null>;
    } else {
      finalQuery = underscore.clone(query as Record<string, unknown>);
      finalCallback = callback as ExtensionCallback<ExtensionModel | null>;
    }
    finalQuery.$one = true;
    const functions = [
      (done: ExtensionCallback<ExtensionModel | null>) => {
        finalQuery[key] = { $lte: date };
        return modelType
          .cursor(finalQuery)
          .sort(`-${key}`)
          .toModels(done as ExtensionCallback<ExtensionModel[] | ExtensionModel | null>);
      },
      (done: ExtensionCallback<ExtensionModel | null>) => {
        finalQuery[key] = { $gte: date };
        return modelType
          .cursor(finalQuery)
          .sort(key)
          .toModels(done as ExtensionCallback<ExtensionModel[] | ExtensionModel | null>);
      },
    ];
    if (finalOptions.reverse) functions.reverse();
    return functions[0]((error, model) => {
      if (error) return finalCallback(error);
      if (model) return finalCallback(null, model);
      return functions[1](finalCallback);
    });
  };
  modelType.each = function each(query: Record<string, unknown> | ((value: unknown, callback: ExtensionCallback) => unknown), iterator: ((value: unknown, callback: ExtensionCallback) => unknown) | ExtensionCallback<number>, callback?: ExtensionCallback<number>): unknown {
    if (arguments.length === 2) return modelEach(runtime, modelType, {}, query as (value: ExtensionModel | Record<string, unknown>, callback: ExtensionCallback) => unknown, iterator as ExtensionCallback<number>);
    return modelEach(runtime, modelType, query as Record<string, unknown>, iterator as (value: ExtensionModel | Record<string, unknown>, callback: ExtensionCallback) => unknown, callback as ExtensionCallback<number>);
  };
  modelType.eachC = function eachC(query: Record<string, unknown> | ExtensionCallback<number>, callback: ExtensionCallback<number> | ((value: unknown, next: ExtensionCallback) => unknown), iterator?: (value: unknown, next: ExtensionCallback) => unknown): unknown {
    if (arguments.length === 2) return modelEach(runtime, modelType, {}, callback as (value: ExtensionModel | Record<string, unknown>, next: ExtensionCallback) => unknown, query as ExtensionCallback<number>);
    return modelEach(runtime, modelType, query as Record<string, unknown>, iterator as (value: ExtensionModel | Record<string, unknown>, next: ExtensionCallback) => unknown, callback as ExtensionCallback<number>);
  };
  modelType.stream = (query?: Record<string, unknown> | null) => {
    if (typeof ModelStream !== 'function') throw new Error('Stream is a large dependency so you need to manually include "stream.js" in the browser.');
    const ModelStreamConstructor = ModelStream as new (modelType: ExtensionModelConstructor, query?: Record<string, unknown>) => object;
    return new ModelStreamConstructor(modelType, query ?? {});
  };
  modelType.interval = (query, iterator, callback) => modelInterval(runtime, modelType, query, iterator as never, callback);
  modelType.intervalC = (query, callback, iterator) => modelInterval(runtime, modelType, query, iterator as never, callback);

  modelType.prototype.modelName = () => modelType.model_name;
  modelType.prototype.cache = () => modelType.cache;
  const schema = () => modelType.prototype.sync('schema') as unknown as ExtensionSchema | undefined;
  modelType.prototype.schema = modelType.schema = schema;
  const tableName = () => modelType.prototype.sync('tableName') as unknown as string | undefined;
  Reflect.set(modelType.prototype, 'tableName', tableName);
  modelType.tableName = tableName;
  const relation = (key: string) => schema()?.relation(key);
  modelType.prototype.relation = modelType.relation = relation;
  const relationIsEmbedded = (key: string) => {
    const found = modelType.relation(key);
    return found ? Boolean(Reflect.get(found, 'embed')) : false;
  };
  Reflect.set(modelType.prototype, 'relationIsEmbedded', relationIsEmbedded);
  modelType.relationIsEmbedded = relationIsEmbedded;
  const reverseRelation = (key: string) => schema()?.reverseRelation(key);
  Reflect.set(modelType.prototype, 'reverseRelation', reverseRelation);
  modelType.reverseRelation = reverseRelation;
  modelType.prototype.isLoaded = function isLoaded(key?: string): boolean {
    return !(runtime.Utils.orSet(this, 'needs_load', {}) as Record<string, unknown>)[arguments.length === 0 ? '__model__' : (key as string)];
  };
  modelType.prototype.setLoaded = function setLoaded(key: string | boolean, loaded?: boolean): unknown {
    const finalKey = arguments.length === 1 ? '__model__' : (key as string);
    const isLoaded = arguments.length === 1 ? (key as boolean) : loaded;
    const needsLoad = runtime.Utils.orSet(this, 'needs_load', {}) as Record<string, unknown>;
    if (isLoaded && runtime.Utils.get(this, 'is_initialized')) {
      delete needsLoad[finalKey];
      return;
    }
    needsLoad[finalKey] = !isLoaded;
    return needsLoad[finalKey];
  };
  Reflect.set(modelType.prototype, 'isLoadedExists', function isLoadedExists(this: ExtensionModel, key?: string): boolean {
    const finalKey = arguments.length === 0 ? '__model__' : (key as string);
    return Reflect.getOwnPropertyDescriptor(runtime.Utils.orSet(this, 'needs_load', {}) as object, finalKey) !== undefined;
  });
  Reflect.set(modelType.prototype, 'isPartial', function isPartial(this: ExtensionModel): boolean {
    return Boolean(runtime.Utils.get(this, 'partial'));
  });
  Reflect.set(modelType.prototype, 'setPartial', function setPartial(this: ExtensionModel, partial: boolean): unknown {
    return partial ? runtime.Utils.set(this, 'partial', true) : runtime.Utils.unset(this, 'partial');
  });
  modelType.prototype.addUnset = function addUnset(key: string): unknown {
    const unsets = runtime.Utils.orSet(this, 'unsets', []) as string[];
    if (!unsets.includes(key)) return unsets.push(key);
  };
  Reflect.set(modelType.prototype, 'removeUnset', function removeUnset(this: ExtensionModel, key: string): unknown {
    const unsets = runtime.Utils.get(this, 'unsets', null) as string[] | null;
    if (!unsets) return;
    const index = unsets.indexOf(key);
    if (index >= 0) return unsets.splice(index, 1);
  });
  modelType.prototype.fetchRelated = function fetchRelated(relations: string | string[] | ExtensionCallback, callback?: ExtensionCallback): unknown {
    const requested = arguments.length === 1 ? null : relations;
    const done = (arguments.length === 1 ? relations : callback) as ExtensionCallback;
    const queue = new runtime.Queue(1);
    queue.defer((next) => (this.isLoaded() ? next() : Reflect.apply(this.fetch, this, [next])));
    queue.defer((next) => {
      let keys = underscore.keys(runtime.Utils.orSet(this, 'needs_load', {}) as object);
      const list = requested && !underscore.isArray(requested) ? [requested] : requested;
      if (underscore.isArray(list)) keys = underscore.intersection(keys, list as string[]);
      return runtime.Utils.each(keys, (key, relationDone) => Reflect.apply(this.get, this, [key, relationDone]), next);
    });
    return queue.await(done);
  };
  Reflect.set(modelType.prototype, 'patchAdd', function patchAdd(this: ExtensionModel, key: string, related: unknown, callback: ExtensionCallback): unknown {
    const found = this.relation(key);
    if (!found) return callback(new Error(`patchAdd: relation '${key}' unrecognized`));
    if (!related) return callback(new Error(`patchAdd: missing relateds for '${key}'`));
    return found.patchAdd(this, related, callback);
  });
  modelType.prototype.patchRemove = function patchRemove(key: string | ExtensionCallback, related?: unknown, callback?: ExtensionCallback): unknown {
    if (arguments.length === 1) {
      const done = key as ExtensionCallback;
      const queue = new runtime.Queue(1);
      const currentSchema = modelType.schema() as ExtensionSchema;
      for (const found of Object.values(currentSchema.relations)) queue.defer((next) => found.patchRemove(this, next));
      return queue.await(done);
    }
    const found = this.relation(key as string);
    const done = (arguments.length === 2 ? related : callback) as ExtensionCallback;
    if (!found) return done(new Error(`patchRemove: relation '${String(key)}' unrecognized`));
    if (arguments.length === 2) return found.patchRemove(this, done);
    if (!related) return done(new Error(`patchRemove: missing relateds for '${String(key)}'`));
    return found.patchRemove(this, related, done);
  };
  modelType.prototype.cursor = function cursor(this: ExtensionModel, key: string, query?: unknown): unknown {
    const currentSchema = modelType.schema();
    const found = currentSchema?.relation(key);
    if (found) return found.cursor(this, key, query ?? {});
    return (() => {
      throw new Error(`${String((currentSchema as ExtensionSchema).model_name)}::cursor: Unexpected key: ${key} is not a relation`);
    })();
  } as ExtensionModel['cursor'];

  const findOrClone = (model: ExtensionModel, options: Options): ExtensionModel => {
    if (model.isNew() || !model.modelName) return Reflect.apply(model.clone, model, [options]) as ExtensionModel;
    const caches = options._cache as Record<string, Record<PropertyKey, ExtensionModel>>;
    const modelName = model.modelName() as string;
    caches[modelName] ??= {};
    const cache = caches[modelName];
    let clone = cache[model.id as PropertyKey];
    if (!clone) {
      clone = Reflect.apply(model.clone, model, [options]) as ExtensionModel;
      if (model.isLoaded()) cache[model.id as PropertyKey] = clone;
    }
    return clone;
  };

  const overrides: Record<string, OriginalFunction> = {
    initialize(_attributes: unknown): unknown {
      const currentSchema = modelType.schema?.();
      if (currentSchema) {
        for (const currentRelation of Object.values(currentSchema.relations)) currentRelation.initializeModel(this);
        const needsLoad = runtime.Utils.orSet(this, 'needs_load', {}) as Record<string, unknown>;
        for (const [key, value] of Object.entries(needsLoad)) if (!value) delete needsLoad[key];
        runtime.Utils.set(this, 'is_initialized', true);
      }
      return Reflect.apply(modelType.prototype._orm_original_fns?.initialize as OriginalFunction, this, arguments as unknown as unknown[]);
    },
    fetch(options?: Options): unknown {
      const parameters = arguments;
      const callback = parameters[parameters.length - 1];
      let finalOptions = options;
      if (typeof callback === 'function') {
        if (parameters.length === 1) finalOptions = runtime.Utils.wrapOptions({}, callback) as Options;
        else if (parameters.length === 2) finalOptions = runtime.Utils.wrapOptions(options, callback) as Options;
      } else finalOptions ??= {};
      return Reflect.apply(modelType.prototype._orm_original_fns?.fetch as OriginalFunction, this, [
        runtime.Utils.wrapOptions(finalOptions, (error, _model, response, optionsObject) => {
          const wrapped = optionsObject as Options;
          if (error) return wrapped.error?.(this, response, wrapped);
          this.setLoaded(true);
          return wrapped.success?.(this, response, wrapped);
        }),
      ]);
    },
    unset(key: string): unknown {
      this.addUnset(key);
      const id = this.id;
      Reflect.apply(modelType.prototype._orm_original_fns?.unset as OriginalFunction, this, arguments as unknown as unknown[]);
      if (key === 'id' && modelType.cache && id && modelType.cache.get(id) === this) return modelType.cache.destroy(id);
    },
    set(key: unknown, value?: unknown, options?: unknown): unknown {
      const currentSchema = modelType.schema?.();
      if (!currentSchema) return Reflect.apply(modelType.prototype._orm_original_fns?.set as OriginalFunction, this, arguments as unknown as unknown[]);
      let attributes: Record<string, unknown>;
      let finalOptions = options;
      if (underscore.isString(key)) attributes = { [key]: value };
      else {
        attributes = key as Record<string, unknown>;
        finalOptions = value;
      }
      const simpleAttributes: Record<string, unknown> = {};
      const relationalAttributes: Record<string, ExtensionRelation> = {};
      for (const attributeKey in attributes) {
        const found = currentSchema.relation(attributeKey);
        if (found) relationalAttributes[attributeKey] = found;
        else simpleAttributes[attributeKey] = attributes[attributeKey];
      }
      if (!runtime.JSONUtils.isEmptyObject(simpleAttributes)) Reflect.apply(modelType.prototype._orm_original_fns?.set as OriginalFunction, this, [simpleAttributes, finalOptions]);
      for (const [attributeKey, found] of Object.entries(relationalAttributes)) found.set(this, attributeKey, attributes[attributeKey], finalOptions);
      return this;
    },
    get(key: string, callback?: ExtensionCallback): unknown {
      const found = modelType.schema?.()?.relation(key);
      if (found) return found.get(this, key, callback);
      const value = Reflect.apply(modelType.prototype._orm_original_fns?.get as OriginalFunction, this, [key]);
      if (callback) callback(null, value);
      return value;
    },
    toJSON(options?: Options | null): unknown {
      const finalOptions = options ?? {};
      const currentSchema = modelType.schema?.();
      this._orm ??= {};
      if ((this._orm.json as number) > 0) return this.id;
      this._orm.json ||= 0;
      this._orm.json = (this._orm.json as number) + 1;
      const json: Record<string, unknown> = {};
      const keys = finalOptions.keys || this.whitelist || underscore.keys(this.attributes);
      for (const key of keys) {
        const value = this.attributes[key];
        const found = currentSchema?.relation(key);
        if (found) found.appendJSON(json, this);
        else if (runtime.Utils.isCollection(value)) json[key] = underscore.map((value as Backbone.Collection<ExtensionModel>).models, (model) => (model ? model.toJSON(finalOptions) : null));
        else if (runtime.Utils.isModel(value)) json[key] = (value as ExtensionModel).toJSON(finalOptions);
        else json[key] = value;
      }
      this._orm.json = (this._orm.json as number) - 1;
      return json;
    },
    save(key?: unknown, value?: unknown, options?: Options): unknown {
      const parameters = arguments;
      const callback = parameters[parameters.length - 1];
      let attributes: unknown;
      let finalOptions = options;
      if (typeof callback === 'function') {
        if (parameters.length === 1) {
          attributes = {};
          finalOptions = runtime.Utils.wrapOptions({}, callback) as Options;
        } else if (parameters.length === 2) {
          attributes = key;
          finalOptions = runtime.Utils.wrapOptions({}, callback) as Options;
        } else if (parameters.length === 3) {
          attributes = key;
          finalOptions = runtime.Utils.wrapOptions(value, callback) as Options;
        } else {
          attributes = { [key as string]: value };
          finalOptions = runtime.Utils.wrapOptions(options, callback) as Options;
        }
      } else if (parameters.length === 0) {
        attributes = {};
        finalOptions = {};
      } else if (key === null || underscore.isObject(key)) {
        attributes = key;
        finalOptions = value as Options;
      } else attributes = { [key as string]: value };
      if (!this.isLoaded()) return finalOptions?.error?.(this, new Error(`An unloaded model is trying to be saved: ${String(modelType.model_name)}`));
      this._orm ??= {};
      if ((this._orm.save as number) > 0) {
        if (this.id) return finalOptions?.success?.(this, {}, finalOptions);
        return finalOptions?.error?.(this, new Error(`Model is in a save loop: ${String(modelType.model_name)}`));
      }
      this._orm.save ||= 0;
      this._orm.save = (this._orm.save as number) + 1;
      this.set(attributes as Backbone.ModelSetOptions, finalOptions);
      attributes = {};
      return runtime.Utils.presaveBelongsToRelationships(this, (error) => {
        if (error) {
          const state = this._orm as Record<string, unknown>;
          state.save = (state.save as number) - 1;
          return finalOptions?.error?.(this, error);
        }
        return Reflect.apply(modelType.prototype._orm_original_fns?.save as OriginalFunction, this, [
          attributes,
          runtime.Utils.wrapOptions(finalOptions, (saveError, _model, response, optionsObject) => {
            const wrapped = optionsObject as Options;
            runtime.Utils.unset(this, 'unsets');
            const state = this._orm as Record<string, unknown>;
            state.save = (state.save as number) - 1;
            if (saveError) return wrapped.error?.(this, response, wrapped);
            const queue = new runtime.Queue(1);
            const currentSchema = modelType.schema?.();
            if (currentSchema) for (const found of Object.values(currentSchema.relations)) queue.defer((next) => found.save(this, next));
            return queue.await((relationError) => {
              if (relationError) return wrapped.error?.(this, new Error(`Failed to save relations. ${String(relationError)}`), wrapped);
              modelType.cache?.set(this.id, this);
              return wrapped.success?.(this, response, wrapped);
            });
          }),
        ]);
      });
    },
    destroy(options?: Options): unknown {
      const parameters = arguments;
      const callback = parameters[parameters.length - 1];
      let finalOptions = options;
      if (typeof callback === 'function') {
        if (parameters.length === 1) finalOptions = runtime.Utils.wrapOptions({}, callback) as Options;
        else if (parameters.length === 2) finalOptions = runtime.Utils.wrapOptions(options, callback) as Options;
      }
      const memoryDeletion = ownedMemoryDeletion(runtime, modelType, this.sync);
      if (memoryDeletion) {
        const error = this.isNew() ? undefined : memoryDeletion.preflight();
        if (error) {
          const errorOptions = underscore.clone(finalOptions ?? {}) as Options;
          if (errorOptions.error) Reflect.apply(errorOptions.error, errorOptions.context, [this, error, errorOptions]);
          this.trigger('error', this, error, errorOptions);
          return;
        }
        return Reflect.apply(modelType.prototype._orm_original_fns?.destroy as OriginalFunction, this, [finalOptions]);
      }
      this.cache()?.destroy(this.id);
      if (!modelType.schema?.()) return Reflect.apply(modelType.prototype._orm_original_fns?.destroy as OriginalFunction, this, [finalOptions]);
      this._orm ??= {};
      if ((this._orm.destroy as number) > 0) throw new Error(`Model is in a destroy loop: ${String(modelType.model_name)}`);
      this._orm.destroy ||= 0;
      this._orm.destroy = (this._orm.destroy as number) + 1;
      return Reflect.apply(modelType.prototype._orm_original_fns?.destroy as OriginalFunction, this, [
        runtime.Utils.wrapOptions(finalOptions, (error, _model, response, optionsObject) => {
          const wrapped = optionsObject as Options;
          const state = this._orm as Record<string, unknown>;
          state.destroy = (state.destroy as number) - 1;
          if (error) return wrapped.error?.(this, response, wrapped);
          return this.patchRemove((patchError) => {
            if (patchError) return wrapped.error?.(this, new Error(`Failed to destroy relations. ${String(patchError)}`), wrapped);
            return wrapped.success?.(this, response, wrapped);
          });
        }),
      ]);
    },
    clone(options?: Options): unknown {
      if (!modelType.schema) return Reflect.apply(modelType.prototype._orm_original_fns?.clone as OriginalFunction, this, arguments as unknown as unknown[]);
      const finalOptions = options ?? {};
      finalOptions._cache ??= {};
      const modelName = this.modelName() as string;
      finalOptions._cache[modelName] ??= {};
      const cache = finalOptions._cache[modelName];
      this._orm ??= {};
      if ((this._orm.clone as number) > 0) return this.id ? cache[this.id as PropertyKey] : Reflect.apply(modelType.prototype._orm_original_fns?.clone as OriginalFunction, this, arguments as unknown as unknown[]);
      this._orm.clone ||= 0;
      this._orm.clone = (this._orm.clone as number) + 1;
      let clone: ExtensionModel;
      if (this.id) {
        clone = cache[this.id as PropertyKey];
        if (!clone) {
          clone = new (this.constructor as ExtensionModelConstructor)();
          if (this.isLoaded()) cache[this.id as PropertyKey] = clone;
        }
      } else clone = new (this.constructor as ExtensionModelConstructor)();
      if (this.attributes.id) clone.id = this.attributes.id;
      const keys = finalOptions.keys || underscore.keys(this.attributes);
      for (const key of keys) {
        const attribute = this.attributes[key];
        if (runtime.Utils.isCollection(attribute)) {
          const collection = attribute as Backbone.Collection<ExtensionModel>;
          const current = clone.attributes[key] as Backbone.Collection<ExtensionModel> & { values?: unknown };
          if (!current?.values) clone.attributes[key] = new (collection.constructor as new () => Backbone.Collection<ExtensionModel>)();
          (clone.attributes[key] as Backbone.Collection<ExtensionModel>).reset(collection.models.map((model) => findOrClone(model, finalOptions)));
        } else if (runtime.Utils.isModel(attribute)) clone.attributes[key] = findOrClone(attribute as ExtensionModel, finalOptions);
        else clone.attributes[key] = attribute;
      }
      this._orm.clone = (this._orm.clone as number) - 1;
      return clone;
    },
  };

  if (!modelType.prototype._orm_original_fns) {
    modelType.prototype._orm_original_fns = {};
    for (const [key, override] of Object.entries(overrides)) {
      modelType.prototype._orm_original_fns[key] = Reflect.get(modelType.prototype, key) as OriginalFunction;
      Reflect.set(modelType.prototype, key, override);
    }
  }
  return undefined;
}
