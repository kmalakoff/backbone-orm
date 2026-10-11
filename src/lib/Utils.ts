// biome-ignore-all lint/complexity/noArguments: The published resetSchemas overload distinguishes exact argument counts.
import type Backbone from 'backbone';
import type { ExtensionModel, ExtensionModelConstructor, ExtensionUnderscore } from '../extensions/contracts.ts';
import installModelExtensions from '../extensions/model.ts';
import type { BackboneORMRuntime, ErrorCallback, ModelConstructor, ModelSync, ResultCallback, RuntimeUtils } from '../types.ts';

interface RuntimeURLModule {
  format(value: object): string;
  parse(value: string): { pathname?: string | null; [key: string]: unknown };
}

interface MutableORMObject {
  _orm?: Record<string, unknown>;
}

type CallbackOptions = Record<string, unknown> & {
  error?: (model: unknown, response: unknown, options: object) => unknown;
  success?: (model: unknown, response: unknown, options: object) => unknown;
};

type BackboneCallback = (error: Error | null, model?: unknown, response?: unknown, options?: object) => unknown;

function hasOwn(value: object, key: PropertyKey): boolean {
  return Reflect.getOwnPropertyDescriptor(value, key) !== undefined;
}

export function createModelJSONSaveOptions(callback: BackboneCallback): { success(response?: unknown): unknown; error(error: Error): unknown } {
  let completed = false;
  return {
    success(response) {
      if (completed) return;
      completed = true;
      return callback(null, response, undefined, undefined);
    },
    error(error) {
      if (completed) return;
      completed = true;
      return callback(error);
    },
  };
}

export default function createUtils(runtime: BackboneORMRuntime): RuntimeUtils {
  const underscore = runtime._ as ExtensionUnderscore;
  const Utils: RuntimeUtils = runtime.Utils;

  Utils.resetSchemas = function resetSchemas(modelTypes: ExtensionModelConstructor[], optionsOrCallback: object | ErrorCallback, possibleCallback?: ErrorCallback): unknown {
    const options = arguments.length === 2 ? {} : (optionsOrCallback as Record<string, unknown>);
    const callback = (arguments.length === 2 ? optionsOrCallback : possibleCallback) as ErrorCallback;
    for (const modelType of modelTypes) modelType.schema();
    const failedSchemas: Array<string | undefined> = [];
    return Utils.each(
      modelTypes,
      (modelType, next) =>
        modelType.resetSchema(options, (error) => {
          if (error) {
            failedSchemas.push(modelType.model_name);
            console.log(`Error when dropping schema for ${String(modelType.model_name)}. ${String(error)}`);
          }
          return next();
        }),
      () => {
        if (options.verbose) console.log(`${modelTypes.length - failedSchemas.length} schemas dropped.`);
        runtime.model_cache.reset?.();
        if (failedSchemas.length) return callback(new Error(`Failed to migrate schemas: ${failedSchemas.join(', ')}`));
        return callback();
      }
    );
  };

  Utils.bbCallback = function bbCallback(callback: BackboneCallback): CallbackOptions {
    return {
      success(model, response, options) {
        return callback(null, model, response, options);
      },
      error(model, response, options) {
        return callback((response as Error) || new Error('Backbone call failed'), model, response, options);
      },
    };
  };

  Utils.wrapOptions = function wrapOptions(options: CallbackOptions | BackboneCallback | null | undefined, callback: BackboneCallback): CallbackOptions {
    const normalizedOptions = options ?? {};
    const originalOptions = underscore.isFunction(normalizedOptions) ? Utils.bbCallback(normalizedOptions as BackboneCallback) : normalizedOptions;
    return underscore.defaults(
      Utils.bbCallback((error, model, response) => callback(error, model, response, originalOptions)),
      originalOptions
    );
  };

  Utils.isModel = function isModel(value: unknown): unknown {
    if (!value) return value;
    const candidate = Object(value) as Record<string, unknown>;
    return candidate.attributes && (value instanceof runtime.Backbone.Model || (candidate.parse && candidate.fetch));
  };

  Utils.isCollection = function isCollection(value: unknown): unknown {
    if (!value) return value;
    const candidate = Object(value) as Record<string, unknown>;
    return candidate.models && (value instanceof runtime.Backbone.Collection || (candidate.reset && candidate.fetch));
  };

  Utils.get = function get(object: MutableORMObject, key: string, defaultValue?: unknown): unknown {
    return !object._orm || !hasOwn(object._orm, key) ? defaultValue : object._orm[key];
  };

  Utils.set = function set(object: MutableORMObject, key: string, value: unknown): unknown {
    object._orm ??= {};
    object._orm[key] = value;
    return value;
  };

  Utils.orSet = function orSet(object: MutableORMObject, key: string, value: unknown): unknown {
    object._orm ??= {};
    if (!hasOwn(object._orm, key)) object._orm[key] = value;
    return object._orm[key];
  };

  Utils.unset = function unset(object: MutableORMObject, key: string): boolean {
    object._orm ??= {};
    return delete object._orm[key];
  };

  Utils.configureCollectionModelType = function configureCollectionModelType(type, sync): ModelConstructor<Backbone.Model> {
    const collectionType = type as unknown as { prototype: Backbone.Collection & { model?: ExtensionModelConstructor; schema?: unknown; url?: unknown } };
    const modelURL = function modelURL(this: ExtensionModel): unknown {
      let url = underscore.result((this.collection as object | undefined) ?? collectionType.prototype, 'url') as string;
      if (!this.isNew()) {
        const urlParts = (runtime.modules as { url: RuntimeURLModule }).url.parse(url);
        urlParts.pathname = `${String(urlParts.pathname)}/encodeURIComponent(@id)`;
        url = (runtime.modules as { url: RuntimeURLModule }).url.format(urlParts);
      }
      return url;
    };
    let modelType = collectionType.prototype.model;
    if (!modelType || modelType === (runtime.Backbone.Model as unknown as ExtensionModelConstructor)) {
      class ORMModel extends runtime.Backbone.Model {}
      Reflect.set(ORMModel.prototype, 'url', modelURL);
      Reflect.set(ORMModel.prototype, 'schema', collectionType.prototype.schema);
      Reflect.set(ORMModel.prototype, 'sync', (sync as unknown as (type: ExtensionModelConstructor) => ModelSync)(ORMModel as unknown as ExtensionModelConstructor));
      modelType = ORMModel as unknown as ExtensionModelConstructor;
      collectionType.prototype.model = modelType;
      return modelType as unknown as ModelConstructor<Backbone.Model>;
    }
    if (modelType.prototype.sync === runtime.Backbone.Model.prototype.sync) {
      Reflect.set(modelType.prototype, 'url', modelURL);
      Reflect.set(modelType.prototype, 'schema', collectionType.prototype.schema);
      modelType.prototype.sync = (sync as unknown as (type: ExtensionModelConstructor) => ModelSync)(modelType);
    }
    return modelType as unknown as ModelConstructor<Backbone.Model>;
  };

  Utils.configureModelType = function configureModelType(type): unknown {
    return installModelExtensions(runtime, type as unknown as ExtensionModelConstructor);
  };

  Utils.patchRemove = function patchRemove(modelType, model, callback): unknown {
    const schema = (modelType as unknown as ExtensionModelConstructor).schema();
    if (!schema) return callback();
    const queue = new runtime.Queue(1);
    for (const relation of Object.values(schema.relations)) queue.defer((next) => relation.patchRemove(model as unknown as ExtensionModel, next));
    return queue.await(callback);
  };
  Utils.patchRemoveByJSON = Utils.patchRemove;

  Utils.presaveBelongsToRelationships = function presaveBelongsToRelationships(model: ExtensionModel, callback: ErrorCallback): unknown {
    if (!model.schema) return callback();
    const queue = new runtime.Queue(1);
    const schema = model.schema();
    if (schema) {
      for (const [key, relation] of Object.entries(schema.relations)) {
        if (relation.type !== 'belongsTo' || relation.isVirtual()) continue;
        const value = model.get(key) as ExtensionModel | Backbone.Collection<ExtensionModel> | undefined;
        if (!value) continue;
        const relatedModels = 'models' in value ? value.models : [value];
        for (const relatedModel of relatedModels) {
          if (relatedModel.id) continue;
          queue.defer((next) => Reflect.apply(relatedModel.save, relatedModel, [next]));
        }
      }
    }
    return queue.await(callback);
  };

  Utils.dataId = function dataId(data: unknown): unknown {
    return underscore.isObject(data) ? Reflect.get(data as object, 'id') : data;
  };

  Utils.dataIsSameModel = function dataIsSameModel(left: unknown, right: unknown): boolean {
    const leftId = Utils.dataId(left);
    const rightId = Utils.dataId(right);
    return leftId || rightId ? leftId === rightId : underscore.isEqual(left, right);
  };

  Utils.dataToModel = function dataToModel<M extends Backbone.Model>(data: unknown, inputModelType: ModelConstructor<M>): M | M[] | null {
    const modelType = inputModelType as unknown as ExtensionModelConstructor;
    if (!data) return null;
    if (underscore.isArray(data)) return data.map((item) => Utils.dataToModel(item, inputModelType) as M);
    let model: ExtensionModel;
    if (Utils.isModel(data)) model = data as ExtensionModel;
    else if (Utils.dataId(data) !== data) model = new modelType(modelType.prototype.parse(data));
    else {
      const attributes: Record<string, unknown> = { [modelType.prototype.idAttribute]: data };
      model = new modelType(attributes);
      model.setLoaded(false);
    }
    return model as unknown as M;
  };

  Utils.updateModel = function updateModel<M extends Backbone.Model>(target: M, source: Backbone.Model | Record<string, unknown>): M {
    const model = target as unknown as ExtensionModel;
    const data = source as unknown as ExtensionModel | Record<string, unknown> | null;
    if (!data || model === data || Reflect.get(Object(data), '_orm_needs_load')) return target;
    const attributes = Utils.isModel(data) ? (data as ExtensionModel).toJSON() : data;
    if (Utils.dataId(attributes) !== attributes) {
      model.setLoaded(true);
      model.set(attributes as Backbone.ModelSetOptions);
    }
    return target;
  };

  Utils.updateOrNew = function updateOrNew<M extends Backbone.Model>(data: unknown, inputModelType: ModelConstructor<M>): M | null {
    const modelType = inputModelType as unknown as ExtensionModelConstructor;
    const cache = modelType.cache;
    const id = Utils.dataId(data);
    let model: ExtensionModel | undefined;
    if (cache && (id || id === 0)) {
      if (Utils.isModel(data) && (data as ExtensionModel).isLoaded()) model = data as ExtensionModel;
      else {
        model = cache.get(id);
        if (model) Utils.updateModel(model, data as Record<string, unknown>);
      }
    }
    if (!model) {
      model = Utils.isModel(data) ? (data as ExtensionModel) : ((Utils.dataToModel(data, inputModelType) as ExtensionModel | null) ?? undefined);
      if (model && cache) cache.set(model.id, model);
    }
    return (model as unknown as M | undefined) ?? null;
  };

  Utils.modelJSONSave = function modelJSONSave(modelJSON: Record<string, unknown>, inputModelType: ModelConstructor<Backbone.Model>, callback: ResultCallback<unknown>): unknown {
    const modelType = inputModelType as unknown as ExtensionModelConstructor;
    modelType._orm ??= {};
    if (!modelType._orm.model_type_json) {
      let urlRoot: unknown;
      try {
        urlRoot = underscore.result(new modelType(), 'url');
      } catch {}
      class JSONModel extends runtime.Backbone.Model {}
      Reflect.set(JSONModel.prototype, '_orm_never_cache', true);
      Reflect.set(JSONModel.prototype, 'urlRoot', () => urlRoot);
      modelType._orm.model_type_json = JSONModel;
    }
    const selected = modelType.prototype.whitelist ? underscore.pick(modelJSON, modelType.prototype.whitelist) : modelJSON;
    const JSONModel = modelType._orm.model_type_json as new (attributes?: object) => Backbone.Model;
    return modelType.prototype.sync('update', new JSONModel(selected), createModelJSONSaveOptions(callback));
  };

  Utils.isSorted = function isSorted(models: ExtensionModel[], fields: unknown[]): boolean {
    const uniqueFields = underscore.uniq(fields);
    let previous: ExtensionModel | undefined;
    for (const model of models) {
      if (previous && Utils.fieldCompare(previous, model, uniqueFields) === 1) return false;
      previous = model;
    }
    return true;
  };

  Utils.fieldCompare = function fieldCompare(model: ExtensionModel, otherModel: ExtensionModel, fields: unknown[]): number {
    let field = fields[0] as string | [string];
    if (underscore.isArray(field)) field = field[0];
    let descending = false;
    if (field.charAt(0) === '-') {
      field = field.slice(1);
      descending = true;
    }
    if (model.get(field) === otherModel.get(field)) return fields.length > 1 ? Utils.fieldCompare(model, otherModel, fields.splice(1)) : 0;
    if (descending) return (model.get(field) as never) < (otherModel.get(field) as never) ? 1 : -1;
    return (model.get(field) as never) > (otherModel.get(field) as never) ? 1 : -1;
  };

  Utils.jsonFieldCompare = function jsonFieldCompare(model: Record<string, unknown>, otherModel: Record<string, unknown>, fields: unknown[]): number {
    let field = fields[0] as string | [string];
    if (underscore.isArray(field)) field = field[0];
    let descending = false;
    if (field.charAt(0) === '-') {
      field = field.slice(1);
      descending = true;
    }
    if (model[field] === otherModel[field]) return fields.length > 1 ? Utils.jsonFieldCompare(model, otherModel, fields.splice(1)) : 0;
    const left = runtime.JSONUtils.stringify(model[field]);
    const right = runtime.JSONUtils.stringify(otherModel[field]);
    if (descending) return (left as string) < (right as string) ? 1 : -1;
    return (left as string) > (right as string) ? 1 : -1;
  };

  return Utils;
}
