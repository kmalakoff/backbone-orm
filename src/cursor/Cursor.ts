import type Backbone from 'backbone';

import type { CursorCallback, CursorDependencies, CursorJSON, CursorQuery, ModelType, Relation } from './contracts.ts';

let dependencies: CursorDependencies | undefined;

export function installCursorDependencies(value: CursorDependencies): void {
  dependencies = value;
}

function getDependencies(): CursorDependencies {
  if (!dependencies) throw new Error('Cursor dependencies are not installed');
  return dependencies;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

const hasOwn = (value: object, key: PropertyKey): boolean => Reflect.getOwnPropertyDescriptor(value, key) !== undefined;

function flatten(values: unknown[]): unknown[] {
  return values.flat(Infinity);
}

function intersect(current: unknown[] | undefined, values: unknown[]): unknown[] {
  return current ? current.filter((value) => values.includes(value)) : values;
}

export interface CursorInstance {
  model_type: ModelType;
  _find: Record<string, unknown>;
  _cursor: Record<string, unknown>;
  toJSON(callback: CursorCallback): unknown;
  count(callback: CursorCallback<number>): unknown;
  exists(callback: CursorCallback<boolean>): unknown;
  toModel(callback: CursorCallback<Backbone.Model | null>): unknown;
  toModels(callback: CursorCallback<Backbone.Model[] | Backbone.Model | null>): unknown;
  hasCursorQuery(key: string): boolean;
  selectResults(json: CursorJSON[]): unknown;
  prepareIncludes(json: CursorJSON[], callback: CursorCallback<CursorJSON[]>): unknown;
  queryToJSON(callback: CursorCallback): unknown;
  execWithCursorQuery(key: string, method: string, callback: CursorCallback): unknown;
  relatedModelTypesInQuery(): ModelType[];
  selectFromModels(models: Backbone.Model[], callback?: CursorCallback): Backbone.Model[];
}

export type CursorConstructor = {
  new (query: unknown, options: Record<string, unknown>): CursorInstance;
  (this: CursorInstance, query: unknown, options: Record<string, unknown>): void;
  prototype: CursorInstance;
  parseQuery(query: unknown, modelType: ModelType): CursorQuery;
  validateQuery(query: Record<string, unknown>, memo: string | null, modelType: ModelType): void;
};

function Cursor(this: CursorInstance, query: unknown, options: Record<string, unknown>): void {
  Object.assign(this, options);
  const parsed = CursorType.parseQuery(query, this.model_type);
  this._find = parsed.find;
  this._cursor = parsed.cursor;
  for (const key of ['$whitelist', '$select', '$values', '$unique']) {
    if (this._cursor[key] && !Array.isArray(this._cursor[key])) this._cursor[key] = [this._cursor[key]];
  }
}

Cursor.prototype.offset = function offset(this: CursorInstance, value: number) {
  this._cursor.$offset = value;
  return this;
};
Cursor.prototype.limit = function limit(this: CursorInstance, value: number) {
  this._cursor.$limit = value;
  return this;
};
Cursor.prototype.sort = function sort(this: CursorInstance, value: unknown) {
  this._cursor.$sort = value;
  return this;
};
Cursor.prototype.whiteList = function whiteList(this: CursorInstance, ...values: unknown[]) {
  this._cursor.$whitelist = intersect(this._cursor.$whitelist as unknown[] | undefined, flatten(values));
  return this;
};
Cursor.prototype.select = function select(this: CursorInstance, ...values: unknown[]) {
  this._cursor.$select = intersect(this._cursor.$select as unknown[] | undefined, flatten(values));
  return this;
};
Cursor.prototype.include = function include(this: CursorInstance, ...values: unknown[]) {
  this._cursor.$include = intersect(this._cursor.$include as unknown[] | undefined, flatten(values));
  return this;
};
Cursor.prototype.values = function cursorValues(this: CursorInstance, ...values: unknown[]) {
  this._cursor.$values = intersect(this._cursor.$values as unknown[] | undefined, flatten(values));
  return this;
};
Cursor.prototype.unique = function unique(this: CursorInstance, ...values: unknown[]) {
  this._cursor.$unique = intersect(this._cursor.$unique as unknown[] | undefined, flatten(values));
  return this;
};
Cursor.prototype.ids = function ids(this: CursorInstance) {
  this._cursor.$values = ['id'];
  return this;
};
Cursor.prototype.count = function count(this: CursorInstance, callback: CursorCallback<number>): unknown {
  return this.execWithCursorQuery('$count', 'toJSON', callback as CursorCallback);
};
Cursor.prototype.exists = function exists(this: CursorInstance, callback: CursorCallback<boolean>): unknown {
  return this.execWithCursorQuery('$exists', 'toJSON', callback as CursorCallback);
};
Cursor.prototype.toModel = function toModel(this: CursorInstance, callback: CursorCallback<Backbone.Model | null>): unknown {
  return this.execWithCursorQuery('$one', 'toModels', callback as CursorCallback);
};
Cursor.prototype.toModels = function toModels(this: CursorInstance, callback: CursorCallback<Backbone.Model[] | Backbone.Model | null>): unknown {
  if (this._cursor.$values) {
    const values = getDependencies().JSONUtils.stringify?.(this._cursor.$values) ?? String(this._cursor.$values);
    return callback(new Error(`Cannot call toModels on cursor with values for model ${this.model_type.model_name}. Values: ${values}`));
  }

  return this.toJSON((error, value) => {
    if (error) return callback(error);
    if (this._cursor.$one && !value) return callback(null, null);
    const json = Array.isArray(value) ? (value as CursorJSON[]) : [value as CursorJSON];
    return this.prepareIncludes(json, (includeError, prepared) => {
      if (includeError) return callback(includeError);
      const Model = this.model_type as unknown as new (attributes?: object) => Backbone.Model;
      const canCache = !(this._cursor.$select || this._cursor.$whitelist);
      const models = (prepared ?? []).map((item) => {
        if (canCache) return getDependencies().Utils.updateOrNew?.(item, this.model_type) ?? new Model(item);
        const model = new Model(this.model_type.prototype.parse(item));
        (model as Backbone.Model & { setPartial(value: boolean): void }).setPartial(true);
        return model;
      });
      return callback(null, this._cursor.$one ? models[0] : models);
    });
  });
};
Cursor.prototype.toJSON = function toJSON(this: CursorInstance, callback: CursorCallback): unknown {
  return this.queryToJSON(callback);
};
Cursor.prototype.queryToJSON = function queryToJSON(this: CursorInstance, _callback: CursorCallback): unknown {
  throw new Error('queryToJSON must be implemented by a concrete cursor for a Backbone Sync type');
};
Cursor.prototype.hasCursorQuery = function hasCursorQuery(this: CursorInstance, key: string): boolean {
  return Boolean(this._cursor[key]) || this._cursor[key] === '';
};
Cursor.prototype.execWithCursorQuery = function execWithCursorQuery(this: CursorInstance, key: string, method: string, callback: CursorCallback): unknown {
  const value = this._cursor[key];
  this._cursor[key] = true;
  return (this as unknown as Record<string, (next: CursorCallback) => unknown>)[method]((error, json) => {
    if (value === undefined) delete this._cursor[key];
    else this._cursor[key] = value;
    return callback(error, json);
  });
};
Cursor.prototype.relatedModelTypesInQuery = function relatedModelTypesInQuery(this: CursorInstance): ModelType[] {
  let relatedFields: string[] = [];
  const relatedModelTypes: ModelType[] = [];
  for (const key of Object.keys(this._find)) {
    if (key.indexOf('.') > 0) relatedFields.push(key.split('.')[0]);
    else {
      const reverseRelation = this.model_type.reverseRelation?.(key);
      if (reverseRelation?.join_table && reverseRelation.model_type) relatedModelTypes.push(reverseRelation.model_type, reverseRelation.join_table);
    }
  }
  if (this._cursor.$include) relatedFields = relatedFields.concat(this._cursor.$include as string | string[]);
  for (const relationKey of relatedFields) {
    const relation = this.model_type.relation?.(relationKey);
    if (relation?.reverse_model_type) relatedModelTypes.push(relation.reverse_model_type);
    if (relation?.join_table) relatedModelTypes.push(relation.join_table);
  }
  return relatedModelTypes;
};
Cursor.prototype.selectResults = function selectResults(this: CursorInstance, input: CursorJSON[]): unknown {
  const rows = this._cursor.$one ? input.slice(0, 1) : input;
  let json: unknown[] = rows;
  if (this._cursor.$values) {
    const values = this._cursor.$values as string[];
    const selected = this._cursor.$whitelist ? values.filter((key) => (this._cursor.$whitelist as string[]).includes(key)) : values;
    if (values.length === 1) {
      const key = values[0];
      json = selected.length ? rows.map((item) => (hasOwn(item, key) ? item[key] : null)) : rows.map(() => null);
    } else {
      json = rows.map((item) => selected.filter((key) => hasOwn(item, key)).map((key) => item[key]));
    }
  } else if (this._cursor.$select) {
    const selected = this._cursor.$whitelist ? (this._cursor.$select as string[]).filter((key) => (this._cursor.$whitelist as string[]).includes(key)) : (this._cursor.$select as string[]);
    json = rows.map((item) => Object.fromEntries(selected.filter((key) => hasOwn(item, key)).map((key) => [key, item[key]])));
  } else if (this._cursor.$whitelist) {
    const whitelist = this._cursor.$whitelist as string[];
    json = rows.map((item) => Object.fromEntries(whitelist.filter((key) => hasOwn(item, key)).map((key) => [key, item[key]])));
  }
  if (this.hasCursorQuery('$page')) return json;
  return this._cursor.$one ? (json[0] ?? null) : json;
};
Cursor.prototype.selectFromModels = function selectFromModels(this: CursorInstance, models: Backbone.Model[]): Backbone.Model[] {
  const fields = this._cursor.$select ? (this._cursor.$whitelist ? (this._cursor.$select as string[]).filter((key) => (this._cursor.$whitelist as string[]).includes(key)) : (this._cursor.$select as string[])) : (this._cursor.$whitelist as string[] | undefined);
  if (!fields) return models;
  const Model = this.model_type as unknown as new (attributes?: object) => Backbone.Model;
  return models.map((source) => {
    const model = new Model(Object.fromEntries(fields.filter((key) => hasOwn(source.attributes, key)).map((key) => [key, source.attributes[key]])));
    (model as Backbone.Model & { setPartial(value: boolean): void }).setPartial(true);
    return model;
  });
};
Cursor.prototype.prepareIncludes = function prepareIncludes(this: CursorInstance, json: CursorJSON[], callback: CursorCallback<CursorJSON[]>): unknown {
  const includes = this._cursor.$include;
  if (!Array.isArray(includes) || includes.length === 0) return callback(null, json);
  const schema = this.model_type.schema?.();
  for (const include of includes as string[]) {
    const relation = schema?.relation(include) as Relation | undefined;
    const relatedType = relation?.reverse_model_type;
    if (!relatedType) continue;
    const shared = new Map<unknown, Backbone.Model>();
    const findOrNew = (relatedJSON: CursorJSON): Backbone.Model => {
      const relatedId = relatedJSON[relatedType.prototype.idAttribute];
      let model = shared.get(relatedId);
      if (model) return model;
      const cache = relatedType.cache as { get(id: unknown): Backbone.Model | undefined; set(id: unknown, value: Backbone.Model): unknown } | undefined;
      model = cache?.get(relatedId);
      if (!model) {
        const RelatedModel = relatedType as unknown as new (attributes?: object) => Backbone.Model;
        model = new RelatedModel(relatedJSON);
        cache?.set(relatedId, model);
      }
      shared.set(relatedId, model);
      return model;
    };
    for (const modelJSON of json) {
      const relatedJSON = modelJSON[include];
      if (Array.isArray(relatedJSON)) modelJSON[include] = relatedJSON.map((item) => findOrNew(item as CursorJSON));
      else if (relatedJSON) modelJSON[include] = findOrNew(relatedJSON as CursorJSON);
    }
  }
  return callback(null, json);
};

const CursorType = Cursor as unknown as CursorConstructor;
CursorType.validateQuery = function validateQuery(query: Record<string, unknown>, memo: string | null, modelType: ModelType): void {
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && !isObject(value)) continue;
    const fullKey = memo ? `${memo}.${key}` : key;
    if (value === undefined) throw new Error(`Unexpected undefined for query key '${fullKey}' on ${modelType?.model_name}`);
    CursorType.validateQuery(value, fullKey, modelType);
  }
};
CursorType.parseQuery = function parseQuery(query: unknown, modelType: ModelType): CursorQuery {
  if (!query) return { find: {}, cursor: {} };
  if (!isObject(query)) return { find: { id: query }, cursor: { $one: true } };
  if (query.find || query.cursor) return { find: (query.find as Record<string, unknown>) ?? {}, cursor: (query.cursor as Record<string, unknown>) ?? {} };
  try {
    CursorType.validateQuery(query, null, modelType);
  } catch (error) {
    throw new Error(`Error: ${String(error)}. Query: `);
  }
  const parsed: CursorQuery = { find: {}, cursor: {} };
  for (const [key, value] of Object.entries(query)) {
    Object.defineProperty(key[0] === '$' ? parsed.cursor : parsed.find, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return parsed;
};
Cursor.prototype.constructor = Cursor;

export default CursorType;
