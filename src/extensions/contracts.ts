import type Backbone from 'backbone';

import type { ModelSync } from '../types.ts';

export type ExtensionCallback<T = unknown> = (error?: Error | null, value?: T) => unknown;

export interface ExtensionCache {
  destroy(id: unknown): unknown;
  get(id: unknown): ExtensionModel | undefined;
  set(id: unknown, model: ExtensionModel): unknown;
}

export interface ExtensionRelation {
  appendJSON(json: Record<string, unknown>, model: ExtensionModel): unknown;
  cursor(model: ExtensionModel, key: string, query?: unknown): ExtensionCursor;
  get(model: ExtensionModel, key: string, callback?: ExtensionCallback): unknown;
  initializeModel(model: ExtensionModel): unknown;
  isVirtual(): boolean;
  patchAdd(model: ExtensionModel, related: unknown, callback: ExtensionCallback): unknown;
  patchRemove(model: ExtensionModel | Record<string, unknown>, callback: ExtensionCallback): unknown;
  patchRemove(model: ExtensionModel, related: unknown, callback: ExtensionCallback): unknown;
  save(model: ExtensionModel, callback: ExtensionCallback): unknown;
  set(model: ExtensionModel, key: string, value: unknown, options?: unknown): unknown;
  type: string;
}

export interface ExtensionSchema {
  model_name?: string;
  relations: Record<string, ExtensionRelation>;
  relation(key: string): ExtensionRelation | undefined;
  reverseRelation(key: string): ExtensionRelation | null | undefined;
}

export interface ExtensionCursor {
  [key: string]: unknown;
  count(callback: ExtensionCallback<number>): unknown;
  exists(callback: ExtensionCallback<boolean>): unknown;
  limit(value: number): ExtensionCursor;
  sort(value: unknown): ExtensionCursor;
  toJSON(callback: ExtensionCallback<unknown[]>): unknown;
  toModels(callback: ExtensionCallback<ExtensionModel[] | ExtensionModel | null>): unknown;
}

export interface ExtensionModel extends Backbone.Model {
  _orm?: Record<string, unknown>;
  _orm_needs_load?: boolean;
  addUnset(key: string): unknown;
  cache(): ExtensionCache | undefined;
  cursor(key: string, query?: unknown): ExtensionCursor;
  fetchRelated(relations: string | string[] | ExtensionCallback, callback?: ExtensionCallback): unknown;
  isLoaded(): boolean;
  isLoaded(key: string): boolean;
  modelName(): string | undefined;
  patchRemove(callback: ExtensionCallback): unknown;
  relation(key: string): ExtensionRelation | undefined;
  relationIsEmbedded(key: string): boolean;
  reverseRelation(key: string): ExtensionRelation | null | undefined;
  schema(): ExtensionSchema | undefined;
  setLoaded(value: boolean): unknown;
  setLoaded(key: string, value: boolean): unknown;
  tableName(): string | undefined;
  whitelist?: string[];
}

export interface ExtensionModelConstructor {
  new (attributes?: Record<string, unknown>, options?: object): ExtensionModel;
  _orm?: Record<string, unknown>;
  all(callback: ExtensionCallback<ExtensionModel[]>): unknown;
  cache?: ExtensionCache;
  count(query: unknown, callback?: ExtensionCallback<number>): unknown;
  createSync(target: ExtensionModelConstructor): ModelSync;
  cursor(query?: unknown): ExtensionCursor;
  db(): unknown;
  destroy(query: unknown, callback?: ExtensionCallback): unknown;
  each(query: unknown, iterator: unknown, callback?: ExtensionCallback<number>): unknown;
  eachC(query: unknown, callback: ExtensionCallback<number>, iterator?: unknown): unknown;
  exists(query: unknown, callback?: ExtensionCallback<boolean>): unknown;
  find(query: unknown, callback?: ExtensionCallback<ExtensionModel[]>): unknown;
  findOne(query: unknown, callback?: ExtensionCallback<ExtensionModel | null>): unknown;
  findOneNearestDate(date: Date, options: Record<string, unknown>, query: Record<string, unknown>, callback: ExtensionCallback<ExtensionModel | null>): unknown;
  findOrCreate(data: Record<string, unknown>, callback: ExtensionCallback<ExtensionModel>): unknown;
  interval(query: Record<string, unknown>, iterator: unknown, callback: ExtensionCallback): unknown;
  intervalC(query: Record<string, unknown>, callback: ExtensionCallback, iterator: unknown): unknown;
  model_name?: string;
  prototype: ExtensionModel & {
    _orm_original_fns?: Record<string, (...arguments_: never[]) => unknown>;
    idAttribute: string;
    model_name?: string;
    parse(attributes: unknown): Record<string, unknown>;
    schema?: unknown;
    sync: ModelSync;
    url?: unknown;
    urlRoot?: unknown;
  };
  relation(key: string): ExtensionRelation | undefined;
  relationIsEmbedded(key: string): boolean;
  resetSchema(options: object, callback?: ExtensionCallback): unknown;
  reverseRelation(key: string): ExtensionRelation | null | undefined;
  schema(): ExtensionSchema | undefined;
  stream(query?: Record<string, unknown> | null): unknown;
  tableName(): string | undefined;
}

export interface ExtensionUnderscore {
  clone<T>(value: T): T;
  contains<T>(values: T[], value: T): boolean;
  defaults<T extends object>(target: T, ...sources: object[]): T;
  extend<T extends object>(target: T, ...sources: object[]): T;
  intersection<T>(left: T[], right: T[]): T[];
  isArray(value: unknown): value is unknown[];
  isEqual(left: unknown, right: unknown): boolean;
  isFunction(value: unknown): value is (...arguments_: unknown[]) => unknown;
  isObject(value: unknown): boolean;
  isString(value: unknown): value is string;
  isUndefined(value: unknown): value is undefined;
  keys(value: object): string[];
  map<T, R>(values: T[], iterator: (value: T) => R): R[];
  omit<T extends object>(value: T, ...keys: string[]): Partial<T>;
  pick<T extends object>(value: T, keys: string[]): Partial<T>;
  result(value: object, key: string): unknown;
  uniq<T>(values: T[]): T[];
}
