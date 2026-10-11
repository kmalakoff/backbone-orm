import type Backbone from 'backbone';

import type { ModelSync } from '../types.ts';
import type { DeletionContext } from './deletion.ts';

export type ErrorCallback = (error?: Error | null) => unknown;
export type RelationCallback<T = unknown> = (error: Error | null, value?: T) => unknown;
export type ModelJSON = Record<string, unknown> & { id?: unknown };

export interface RelationCursor {
  count?(callback: RelationCallback<number>): unknown;
  offset?(value: number): RelationCursor;
  toJSON(callback: RelationCallback<unknown>): unknown;
}

export interface RelationCache {
  get(id: unknown): RelationalModel | undefined;
  set(id: unknown, model: RelationalModel): unknown;
}

export interface RelationalModel extends Backbone.Model {
  _orm?: Record<string, unknown>;
  _orm_needs_load?: boolean;
  cache(): RelationCache | undefined;
  isLoaded(): boolean;
  isLoaded(key: string): boolean;
  isLoadedExists(key: string): boolean;
  setLoaded(value: boolean): unknown;
  setLoaded(key: string, value: boolean): unknown;
}

export interface RelationalCollection extends Backbone.Collection<RelationalModel> {
  _orm?: Record<string, unknown>;
}

export interface RelationalModelConstructor {
  new (attributes?: ModelJSON, options?: object): RelationalModel;
  _orm?: Record<string, unknown>;
  cache?: RelationCache;
  createSync(type: RelationalModelConstructor): ModelSync;
  cursor(query?: unknown): RelationCursor;
  destroy(query: unknown, callback: ErrorCallback): unknown;
  exists(query: unknown, callback: RelationCallback<boolean>): unknown;
  model_name?: string;
  prototype: RelationalModel & {
    idAttribute: string;
    model_name?: string;
    schema?: unknown;
    sync: ModelSync;
    url?: unknown;
    urlRoot?: unknown;
    whitelist?: string[];
  };
  relation(key: string): RelationContract | undefined;
  schema(): SchemaContract;
  sync?: ModelSync;
}

export interface RuntimeSchemaField {
  indexed?: boolean;
  manual?: boolean;
  type?: unknown;
  [key: string]: unknown;
}

export interface SchemaContract {
  fields: Record<string, RuntimeSchemaField>;
  relations: Record<string, RelationContract>;
  allColumns(): string[];
  allRelations(): RelationalModelConstructor[];
  columns(): string[];
  field(key: string): RuntimeSchemaField | RelationContract | undefined;
  generateBelongsTo(reverseModelType: RelationalModelConstructor): RelationContract;
  generateJoinTable(relation: RelationContract): RelationalModelConstructor;
  idType(key?: string): unknown;
  initialize(): void;
  joinTables(): RelationalModelConstructor[];
  relatedModels(): RelationalModelConstructor[];
  relation(key: string): RelationContract | undefined;
  reverseRelation(reverseKey: string): RelationContract | null;
  type(key: string): unknown;
  type(key: string, type: unknown): SchemaContract;
}

export interface RelationContract {
  as?: string;
  collection_type?: new (...arguments_: never[]) => RelationalCollection;
  embed?: boolean;
  foreign_key: string;
  join_key: string;
  join_table?: RelationalModelConstructor;
  key: string;
  manual_fetch?: boolean;
  model_type: RelationalModelConstructor;
  reverse_model_type: RelationalModelConstructor;
  reverse_relation?: RelationContract;
  type: 'belongsTo' | 'hasMany' | 'hasOne';
  virtual?: boolean;
  virtual_id_accessor: string;
  add?(model: RelationalModel, relatedModel: RelationalModel): unknown;
  cursor(model: RelationalModel | ModelJSON, key: string, query?: ModelJSON): RelationCursor;
  initialize(): void;
  isEmbedded(): boolean;
  isVirtual(): boolean;
  patchAdd(model: RelationalModel, related: unknown, callback: ErrorCallback): unknown;
  patchRemove(model: RelationalModel | ModelJSON, callback: ErrorCallback): unknown;
  patchRemove(model: RelationalModel, related: unknown, callback: ErrorCallback): unknown;
  remove?(model: RelationalModel, relatedModel: RelationalModel): unknown;
  _hasChanged(model: RelationalModel): boolean;
}

export interface RuntimeNamingConventions {
  attribute(modelName: string, plural?: boolean): string;
  foreignKey(value: string, plural?: boolean): string;
  modelName(value: string, plural?: boolean): string;
  tableName(modelName: string): string;
}

export interface RuntimeQueue {
  await(callback: ErrorCallback): unknown;
  defer(task: (callback: ErrorCallback) => unknown): unknown;
}

export interface RuntimeQueueConstructor {
  new (parallelism?: number): RuntimeQueue;
}

export interface RuntimeDatabaseURL {
  format(options: { exclude_table: boolean }): string;
}

export interface RuntimeDatabaseURLConstructor {
  new (url: unknown): RuntimeDatabaseURL;
}

export interface RuntimeJSONUtils {
  stringify(value: unknown): string;
}

export interface RuntimeRelationUtils {
  dataId(data: unknown): unknown;
  dataIsSameModel(left: unknown, right: unknown): boolean;
  each<T>(values: T[], iterator: (value: T, callback: ErrorCallback) => unknown, callback: ErrorCallback): unknown;
  get(object: { _orm?: Record<string, unknown> }, key: string, defaultValue?: unknown): unknown;
  isCollection(value: unknown): boolean;
  isModel(value: unknown): value is RelationalModel;
  modelJSONSave(modelJSON: ModelJSON, modelType: RelationalModelConstructor, callback: ErrorCallback): unknown;
  orSet(object: { _orm?: Record<string, unknown> }, key: string, value: Record<string, unknown>): Record<string, unknown>;
  set(object: { _orm?: Record<string, unknown> }, key: string, value: Record<string, unknown>): Record<string, unknown>;
  unset(object: { _orm?: Record<string, unknown> }, key: string): unknown;
  updateModel(model: RelationalModel, data: unknown): RelationalModel;
  updateOrNew(data: unknown, modelType: RelationalModelConstructor): RelationalModel;
}

export interface RuntimeUnderscore {
  all<T>(values: T[], predicate: (value: T) => boolean): boolean;
  clone<T>(value: T): T;
  contains<T>(values: T[], value: T): boolean;
  difference<T>(values: T[], other: T[]): T[];
  extend<T extends object>(target: T, ...sources: object[]): T;
  find<T>(values: T[], predicate: (value: T) => boolean): T | undefined;
  groupBy<T>(values: T[], iteratee: (value: T) => string): Record<string, T[]>;
  isArray(value: unknown): value is unknown[];
  isFunction(value: unknown): value is (...arguments_: unknown[]) => unknown;
  isNull(value: unknown): value is null;
  isString(value: unknown): value is string;
  isUndefined(value: unknown): value is undefined;
  keys(value: object): string[];
  pluck<T extends object, K extends keyof T>(values: T[], key: K): Array<T[K]>;
  result(object: object, key: string): unknown;
  select<T>(values: T[], predicate: (value: T) => boolean): T[];
}

export interface SchemaDependencies {
  Backbone: typeof Backbone;
  DatabaseURL: RuntimeDatabaseURLConstructor;
  JSONUtils: RuntimeJSONUtils;
  Queue: RuntimeQueueConstructor;
  Utils: RuntimeRelationUtils;
  namingConventions(): RuntimeNamingConventions;
  underscore: RuntimeUnderscore;
}

export type RelationCleanup = (modelType: RelationalModelConstructor, model: RelationalModel | ModelJSON, callback: ErrorCallback, context?: DeletionContext) => unknown;
