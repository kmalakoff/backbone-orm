import type Backbone from 'backbone';

import type { Relation } from '../cursor/contracts.ts';
import type { DeletionContext } from '../schema/deletion.ts';
import type { BackboneORMRuntime, ModelConstructor, ModelSync, RuntimeUtils, SyncFactory } from '../types.ts';

export type ErrorCallback = (error?: Error | null) => unknown;
export type ModelJSON = Record<string, unknown> & { id?: unknown };

export interface MemoryModelConstructor<M extends Backbone.Model = Backbone.Model> extends ModelConstructor<M> {
  cache?: unknown;
  cuid?: string;
  cursor?(query?: unknown): RuntimeCursor;
  model_name?: string;
  relation?(key: string): Relation | undefined;
  relationIsEmbedded?(key: string): boolean;
  reverseRelation?(key: string): Relation | undefined;
  store?: ModelJSON[];
  each?(query: object, iterator: (model: Backbone.Model, callback: ErrorCallback) => unknown, callback: ErrorCallback): unknown;
}

export interface MemorySyncOptions {
  error(error: Error): unknown;
  success(value?: unknown): unknown;
}

export interface RuntimeCursor {
  limit(value: number): RuntimeCursor;
  toJSON(callback: (error: Error | null, value: ModelJSON[]) => unknown): unknown;
}

export interface RuntimeCursorConstructor {
  new (query: unknown, options: { model_type: MemoryModelConstructor; store: ModelJSON[] }): RuntimeCursor;
}

export interface RuntimeSchemaField {
  manual?: boolean;
  type?: unknown;
}

export interface RuntimeSchema {
  field(key: string): RuntimeSchemaField | undefined;
  idType(): unknown;
  initialize(): void;
  type(key: string, type: unknown): RuntimeSchema;
}

export interface RuntimeSchemaConstructor {
  new (modelType: MemoryModelConstructor): RuntimeSchema;
}

export interface RuntimeJSONUtils {
  deepClone<T>(value: T): T;
  isEmptyObject(value: object): boolean;
  stringify(value: unknown): string;
}

export interface RuntimeUnderscore {
  isObject(value: unknown): boolean;
  isEqual(left: unknown, right: unknown): boolean;
  omit(value: object, key: string): Record<string, unknown>;
  sortedIndex<T>(array: T[], value: object, iteratee: string): number;
  uniqueId(prefix: string): string;
}

export interface RuntimeDateUtils {
  isAfter(left: unknown, right: Date): boolean;
  isBefore(left: unknown, right: Date): boolean;
}

export interface RuntimeQueue {
  defer(task: (callback: ErrorCallback) => unknown): unknown;
  await(callback: ErrorCallback): unknown;
}

export interface RuntimeQueueConstructor {
  new (parallelism?: number): RuntimeQueue;
}

export interface RuntimeMemoryUtils extends RuntimeUtils {
  each<T>(values: T[], iterator: (value: T, callback: ErrorCallback) => unknown, callback: ErrorCallback): unknown;
  eachDone<T>(values: T[], iterator: (value: T, callback: (error?: Error | null, done?: boolean) => unknown) => unknown, callback: ErrorCallback): unknown;
  findOrGenerateModelName(modelType: MemoryModelConstructor): string;
  jsonFieldCompare(left: Record<string, unknown>, right: Record<string, unknown>, fields: unknown[]): number;
  patchRemove(modelType: MemoryModelConstructor, model: Backbone.Model | ModelJSON, callback: ErrorCallback, context?: DeletionContext): unknown;
  popEach<T>(values: T[], iterator: (value: T, callback: ErrorCallback) => unknown, callback: ErrorCallback): unknown;
}

export interface RuntimeModelCache {
  configureSync(modelType: MemoryModelConstructor, sync: ModelSync): ModelSync;
  createCache(modelType: MemoryModelConstructor): unknown;
}

export interface MemorySyncDependencies {
  Cursor: RuntimeCursorConstructor;
  JSONUtils: RuntimeJSONUtils;
  Schema: RuntimeSchemaConstructor;
  Utils: RuntimeMemoryUtils;
  patchRemove(modelType: MemoryModelConstructor, model: Backbone.Model | ModelJSON, callback: ErrorCallback, context?: DeletionContext): unknown;
  underscore: RuntimeUnderscore;
}

export interface MemoryRuntime extends Omit<BackboneORMRuntime, 'Schema'> {
  DateUtils: RuntimeDateUtils;
  JSONUtils: RuntimeJSONUtils;
  Queue: RuntimeQueueConstructor;
  Schema: RuntimeSchemaConstructor;
  Utils: RuntimeMemoryUtils;
  model_cache: RuntimeModelCache;
  sync: SyncFactory;
  _: RuntimeUnderscore;
}
