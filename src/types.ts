import type Backbone from 'backbone';
import type MemoryStore from './cache/MemoryStore.ts';
import type { EachOptions } from './extensions/modelEach.ts';
import type { IntervalOptions, IterationInfo } from './extensions/modelInterval.ts';

export type { EachOptions } from './extensions/modelEach.ts';
export type { IntervalOptions, IntervalRange, IterationInfo } from './extensions/modelInterval.ts';

export type ResultCallback<T> = (this: void, error: Error | null, value?: T) => void;
export type ErrorCallback = (this: void, error?: Error | null) => unknown;
export type QueueCallback = (this: void, error?: Error | null) => unknown;
export type QueueTask = (callback: QueueCallback) => unknown;
export type ConnectionPoolCallback = ErrorCallback;
export type ConnectionDisposer<T> = (value: T, callback: ConnectionPoolCallback) => void;

export interface ConnectionPoolInstance {
  readonly cache: unknown;
  del(key: string, callback?: () => unknown): this;
  destroy(key: string, callback?: () => unknown): this;
  dispose(key: string, callback: ConnectionPoolCallback): void;
  dispose(key: string): Promise<void>;
  disposeAll(callback: ConnectionPoolCallback): void;
  disposeAll(): Promise<void>;
  forEach(callback: (value: unknown, key: unknown, cache: unknown) => unknown): unknown;
  get(key: string, callback?: ResultCallback<unknown>): unknown;
  reset(callback?: () => unknown): this;
  set(key: string, value: unknown, callback?: ResultCallback<unknown>): unknown;
  setOwned<T>(key: string, value: T, disposer: ConnectionDisposer<T>): this;
}

export interface DatabaseURLInstance {
  auth?: string | null;
  database: string;
  hash?: string | null;
  host?: string | null;
  hostname?: string | null;
  hosts?: Array<{ host: string; hostname: string; port?: string }>;
  href?: string | null;
  port?: string | null;
  protocol?: string | null;
  query?: unknown;
  search?: string | null;
  slashes?: boolean | null;
  table?: string;
  format(options?: { exclude_query?: boolean; exclude_search?: boolean; exclude_table?: boolean }): string;
  modelName(): string | null;
  parseAuth(): { password: string | null; user: string } | null;
}

export interface DatabaseURLConstructor {
  new (url: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): DatabaseURLInstance;
}

export interface NamingConvention {
  attribute(modelName: string, plural?: boolean): string;
  foreignKey(modelName: string, plural?: boolean): string;
  modelName(tableName: string, plural?: boolean): string;
  tableName(modelName: string): string;
}

export interface NamingConventionConstructor extends NamingConvention {
  new (): object;
}

export interface QueueInstance {
  await(callback: QueueCallback): unknown;
  defer(task: QueueTask): unknown;
}

export interface QueueConstructor {
  new (parallelism?: number): QueueInstance;
}

export interface DateComparable {
  valueOf(): unknown;
}

export type DurationUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export interface DateUtilsConstructor {
  new (): object;
  durationAsMilliseconds(count: number, units: DurationUnit): number;
  durationAsMilliseconds(count: number, units: string): number | undefined;
  isAfter(modelValue: DateComparable, targetValue: DateComparable): boolean;
  isBefore(modelValue: DateComparable, targetValue: DateComparable): boolean;
  isEqual(modelValue: unknown, targetValue: unknown): boolean;
}

export type FabricatorAttributeInput<T> = T extends (...arguments_: never[]) => unknown ? () => T : T | (() => T);

export type FabricatorAttributeInfo<M extends Backbone.Model> = {
  [K in keyof ModelAttributes<M>]?: FabricatorAttributeInput<ModelAttributes<M>[K]>;
};

export type FabricatorRequiredAttributeInfo<A extends Backbone.ObjectHash> = {
  [K in keyof A]: FabricatorAttributeInput<A[K]>;
};

export type FabricatorCallback<M extends Backbone.Model> = (this: void, error: Error | null | undefined, models: M[]) => unknown;

export interface FabricatorModelConstructor<M extends Backbone.Model> {
  new (attributes?: ModelAttributes<M>): M;
  prototype: M;
}

export interface FabricatorRequiredModelConstructor<A extends Backbone.ObjectHash, M extends Backbone.Model<A>> {
  new (attributes: A): M;
  prototype: M;
}

export interface FabricatorUniqueId {
  (): string;
  (prefix: string): () => string;
}

export interface FabricatorConstructor {
  new (): object;
  new: {
    <M extends Backbone.Model>(modelType: FabricatorModelConstructor<M>, count: number, attributesInfo: FabricatorAttributeInfo<M>): M[];
    <A extends Backbone.ObjectHash, M extends Backbone.Model<A>>(modelType: FabricatorRequiredModelConstructor<A, M>, count: number, attributesInfo: FabricatorRequiredAttributeInfo<A>): M[];
  };
  create: {
    <M extends Backbone.Model>(modelType: FabricatorModelConstructor<M>, count: number, attributesInfo: FabricatorAttributeInfo<M>, callback: FabricatorCallback<M>): unknown;
    <A extends Backbone.ObjectHash, M extends Backbone.Model<A>>(modelType: FabricatorRequiredModelConstructor<A, M>, count: number, attributesInfo: FabricatorRequiredAttributeInfo<A>, callback: FabricatorCallback<M>): unknown;
  };
  value(): undefined;
  value<T>(value: T): () => T;
  increment(): undefined;
  increment(value: number): () => number;
  uniqueId: FabricatorUniqueId;
  uniqueString: FabricatorUniqueId;
  date(): Date;
  date(stepMilliseconds: number): () => Date;
  date(start: Date, stepMilliseconds: number): () => Date;
}

export interface TestOptionSet {
  $tags: string;
  cache: boolean;
  embed: boolean;
}

export interface TestUtilsConstructor {
  new (): object;
  optionSets(): TestOptionSet[];
}

export type IterationCallback = (this: void, error?: Error | null) => unknown;
export type IterationDoneCallback = (this: void, error?: Error | null, done?: boolean) => unknown;
export type IterationIterator<T> = (value: T, callback: IterationCallback) => unknown;
export type IterationDoneIterator<T> = (value: T, callback: IterationDoneCallback) => unknown;

export interface RuntimeIterationUtils {
  each<T>(array: T[], iterator: IterationIterator<T>, callback: IterationCallback): unknown;
  eachC<T>(array: T[], callback: IterationCallback, iterator: IterationIterator<T>): unknown;
  eachDone<T>(array: T[], iterator: IterationDoneIterator<T>, callback: IterationCallback): unknown;
  eachDoneC<T>(array: T[], callback: IterationCallback, iterator: IterationDoneIterator<T>): unknown;
  popEach<T>(array: T[], iterator: IterationIterator<T>, callback: IterationCallback): unknown;
  popEachC<T>(array: T[], callback: IterationCallback, iterator: IterationIterator<T>): unknown;
}

export type JSONUtilsCallback<T = unknown> = (this: void, error?: Error | null, value?: T) => unknown;

export interface RuntimeJSONUtils {
  deepClone<T>(value: T, depth?: number): T;
  isEmptyObject(value: unknown): boolean;
  parse(value: unknown, modelType?: unknown): unknown;
  parseDates(value: unknown): unknown;
  parseField(value: unknown, modelType: unknown, key: string): unknown;
  parseQuery(query: Record<string, unknown>): Record<string, unknown>;
  querify(value: Record<string, unknown>): Record<string, string | undefined>;
  renderDSL(model: unknown, dsl: Record<string, unknown>, callback: JSONUtilsCallback): unknown;
  renderDSL(model: unknown, dsl: Record<string, unknown>, options: object, callback: JSONUtilsCallback): unknown;
  renderKey(model: unknown, key: string, callback: JSONUtilsCallback): unknown;
  renderKey(model: unknown, key: string, options: object, callback: JSONUtilsCallback): unknown;
  renderKeys(model: unknown, keys: string[], callback: JSONUtilsCallback<Record<string, unknown>>): unknown;
  renderKeys(model: unknown, keys: string[], options: object, callback: JSONUtilsCallback<Record<string, unknown>>): unknown;
  renderRelated(models: unknown, attributeName: string, template: unknown, callback: JSONUtilsCallback): unknown;
  renderRelated(models: unknown, attributeName: string, template: unknown, options: object, callback: JSONUtilsCallback): unknown;
  renderTemplate(models: unknown, template: unknown, callback: JSONUtilsCallback): unknown;
  renderTemplate(models: unknown, template: unknown, options: object, callback: JSONUtilsCallback): unknown;
  stringify(value: unknown): string | undefined;
  toQuery(value: unknown): unknown;
}

export interface JSONUtilsConstructor extends RuntimeJSONUtils {
  new (): object;
}

export type ModelAttributes<M> = M extends Backbone.Model<infer A> ? A : never;

export type FindQuery<A extends Backbone.ObjectHash> = {
  [K in keyof A]?: A[K];
};

export interface FindMethod<M extends Backbone.Model> {
  (callback: ResultCallback<M[]>): void;
  (query: FindQuery<ModelAttributes<M>>, callback: ResultCallback<M[]>): void;
  (): Promise<M[]>;
  (query: FindQuery<ModelAttributes<M>>): Promise<M[]>;
}

export interface ModelConstructor<M extends Backbone.Model> {
  new (...arguments_: never[]): M;
  model_name?: string;
  prototype: M;
}

export interface SchemaField {
  indexed?: boolean;
  manual?: boolean;
  type?: unknown;
  [key: string]: unknown;
}

export interface Relation {
  as?: string;
  embed?: boolean;
  foreign_key: string;
  join_key: string;
  join_table?: ModelConstructor<Backbone.Model>;
  key: string;
  manual_fetch?: boolean;
  model_type: ModelConstructor<Backbone.Model>;
  reverse_model_type: ModelConstructor<Backbone.Model>;
  reverse_relation?: Relation;
  type: 'belongsTo' | 'hasMany' | 'hasOne';
  virtual?: boolean;
  virtual_id_accessor: string;
  isEmbedded(): boolean;
  isVirtual(): boolean;
}

export interface SchemaInstance {
  fields: Record<string, SchemaField>;
  is_initialized?: boolean;
  model_type: ModelConstructor<Backbone.Model>;
  raw: Record<string, unknown>;
  relations: Record<string, Relation>;
  type_overrides: Record<string, SchemaField>;
  virtual_accessors: Record<string, Relation>;
  allColumns(): string[];
  allRelations(): Array<ModelConstructor<Backbone.Model>>;
  columns(): string[];
  field(key: string): SchemaField | Relation | undefined;
  generateBelongsTo(reverseModelType: ModelConstructor<Backbone.Model>): Relation;
  generateJoinTable(relation: Relation): ModelConstructor<Backbone.Model>;
  idType(key?: string): unknown;
  initialize(): void;
  joinTables(): Array<ModelConstructor<Backbone.Model>>;
  relatedModels(): Array<ModelConstructor<Backbone.Model>>;
  relation(key: string): Relation | undefined;
  reverseRelation(reverseKey: string): Relation | null;
  type(key: string): unknown;
  type(key: string, type: unknown): SchemaInstance;
}

export interface SchemaConstructor {
  new (modelType: ModelConstructor<Backbone.Model>, typeOverrides?: Record<string, SchemaField>): SchemaInstance;
  joinTableURL(relation: Relation): string;
}

export type CursorCallback<T = unknown> = (this: void, error: Error | null, value?: T) => unknown;
export type CursorJSON = Record<string, unknown>;
export type CursorResult = unknown;
export type CursorModelResult<M extends Backbone.Model = Backbone.Model> = M[] | M | null;

export interface CursorModelConstructor<M extends Backbone.Model = Backbone.Model> extends ModelConstructor<M> {
  cache?: unknown;
  model_name?: string;
  relation?(key: string): Relation | undefined;
  relationIsEmbedded?(key: string): boolean;
  reverseRelation?(key: string): Relation | undefined;
  schema?(): SchemaInstance;
  tableName?(): string | undefined;
}

export interface CursorOptions<M extends Backbone.Model = Backbone.Model> {
  model_type: CursorModelConstructor<M>;
  [key: string]: unknown;
}

export interface CursorInstance<M extends Backbone.Model = Backbone.Model> {
  _cursor: Record<string, unknown>;
  _find: Record<string, unknown>;
  model_type: CursorModelConstructor<M>;
  count(callback: CursorCallback<number>): unknown;
  exists(callback: CursorCallback<boolean>): unknown;
  hasCursorQuery(key: string): boolean;
  ids(): this;
  include(...values: unknown[]): this;
  limit(value: number): this;
  offset(value: number): this;
  queryToJSON(callback: CursorCallback<CursorResult>): unknown;
  select(...values: unknown[]): this;
  selectResults(json: CursorJSON[]): CursorResult;
  sort(value: unknown): this;
  toJSON(callback: CursorCallback<CursorResult>): unknown;
  toModel(callback: CursorCallback<M | null>): unknown;
  toModels(callback: CursorCallback<CursorModelResult<M>>): unknown;
  unique(...values: unknown[]): this;
  values(...values: unknown[]): this;
  whiteList(...values: unknown[]): this;
}

export interface CursorConstructor {
  new <M extends Backbone.Model = Backbone.Model>(query: unknown, options: CursorOptions<M>): CursorInstance<M>;
  <M extends Backbone.Model = Backbone.Model>(this: CursorInstance<M>, query: unknown, options: CursorOptions<M>): void;
  prototype: CursorInstance;
  parseQuery(query: unknown, modelType: CursorModelConstructor): { cursor: Record<string, unknown>; find: Record<string, unknown> };
  validateQuery(query: Record<string, unknown>, memo: string | null, modelType: CursorModelConstructor): void;
}

export interface AdapterSync<C extends CursorInstance = CursorInstance, D = unknown> {
  (method: 'cursor', query?: unknown): C;
  (method: 'db'): D;
  (method: 'schema'): SchemaInstance | undefined;
  (method: 'tableName'): string | undefined;
  (method: 'isRemote'): boolean;
  (method: 'resetSchema', options: object, callback: ErrorCallback): unknown;
  (method: 'destroy', query: unknown, callback: ErrorCallback): unknown;
  (method: string, target?: unknown, options?: unknown): unknown;
}

export interface PatchRemoveModelConstructor<M extends Backbone.Model = Backbone.Model> extends ModelConstructor<M> {
  schema(): SchemaInstance | undefined;
}

export type PatchRemove = (modelType: PatchRemoveModelConstructor, model: Backbone.Model | Record<string, unknown>, callback: ErrorCallback) => unknown;

export interface CollectionConstructor<C extends Backbone.Collection> {
  new (...arguments_: never[]): C;
  prototype: C;
}

export type EachQuery = Record<string, unknown> & { $each?: EachOptions };
export type IntervalQuery = Record<string, unknown> & { $interval: IntervalOptions & { key: string; type: DurationUnit } };
export type IntervalIterator = (query: Record<string, unknown>, information: IterationInfo, callback: IterationCallback) => unknown;

export interface FindOneNearestDateOptions extends Record<string, unknown> {
  key: string;
  reverse?: unknown;
}

export interface ConfiguredModelStatics<M extends Backbone.Model, D = unknown, S = unknown> {
  all(callback: CursorCallback<M[]>): unknown;
  count(callback: CursorCallback<number>): unknown;
  count(query: unknown, callback: CursorCallback<number>): unknown;
  cursor(query?: unknown): CursorInstance<M>;
  db(): D;
  destroy(callback: ErrorCallback): unknown;
  destroy(query: unknown, callback: ErrorCallback): unknown;
  each(iterator: IterationIterator<M>, callback: CursorCallback<number>): unknown;
  each(query: EachQuery & { $each: EachOptions & { json: false } }, iterator: IterationIterator<M>, callback: CursorCallback<number>): unknown;
  each(query: EachQuery, iterator: IterationIterator<unknown>, callback: CursorCallback<number>): unknown;
  eachC(callback: CursorCallback<number>, iterator: IterationIterator<M>): unknown;
  eachC(query: EachQuery & { $each: EachOptions & { json: false } }, callback: CursorCallback<number>, iterator: IterationIterator<M>): unknown;
  eachC(query: EachQuery, callback: CursorCallback<number>, iterator: IterationIterator<unknown>): unknown;
  exists(callback: CursorCallback<boolean>): unknown;
  exists(query: unknown, callback: CursorCallback<boolean>): unknown;
  find: FindMethod<M>;
  findOne(callback: CursorCallback<M | null>): unknown;
  findOne(query: unknown, callback: CursorCallback<M | null>): unknown;
  findOneNearestDate(date: Date, options: FindOneNearestDateOptions, callback: CursorCallback<M | null>): unknown;
  findOneNearestDate(date: Date, options: FindOneNearestDateOptions, query: Record<string, unknown>, callback: CursorCallback<M | null>): unknown;
  findOrCreate(data: Partial<ModelAttributes<M>>, callback: CursorCallback<M>): unknown;
  interval(query: IntervalQuery, iterator: IntervalIterator, callback: IterationCallback): unknown;
  intervalC(query: IntervalQuery, callback: IterationCallback, iterator: IntervalIterator): unknown;
  resetSchema(callback: ErrorCallback): unknown;
  resetSchema(options: object, callback: ErrorCallback): unknown;
  schema(): S;
  tableName(): string | undefined;
}

export interface ORMModelConstructor<M extends Backbone.Model, D = unknown, S = object> extends ModelConstructor<M>, ConfiguredModelStatics<M, D, S> {
  new (attributes?: Partial<ModelAttributes<M>> & { id?: number | string }, options?: object): M;
}

export type ConfiguredModelInstance<M extends Backbone.Model> = M & {
  isLoaded(key?: string): boolean;
  setLoaded(loaded: boolean): boolean | undefined;
  setLoaded(key: string, loaded: boolean): boolean | undefined;
  fetchRelated(callback: ErrorCallback): unknown;
  fetchRelated(relations: string | string[], callback: ErrorCallback): unknown;
};

export type ConfiguredModelConstructor<C extends ModelConstructor<Backbone.Model>, D = unknown, S = SchemaInstance> = Omit<C, keyof ConfiguredModelStatics<InstanceType<C>, D, S> | 'prototype'> &
  (new (
    ...arguments_: ConstructorParameters<C>
  ) => ConfiguredModelInstance<InstanceType<C>>) & {
    prototype: ConfiguredModelInstance<InstanceType<C>>;
  } & ConfiguredModelStatics<InstanceType<C>, D, S>;

export interface ConfigureModel {
  <C extends ModelConstructor<Backbone.Model>>(modelType: C): ConfiguredModelConstructor<C>;
  (modelType: ModelConstructor<Backbone.Model>): ConfiguredModelConstructor<ModelConstructor<Backbone.Model>>;
}

export type ModelSync = Backbone.Model['sync'];
export type CollectionSync = Backbone.Collection['sync'];

export interface MemoryCapabilities {
  dynamic: true;
  embed: true;
  json: true;
  manual_ids: true;
  self_reference: true;
  unique: true;
}

export type MemoryModelJSON = Record<string, unknown> & { id?: unknown };
export type MemorySyncErrorCallback = (error?: Error | null) => unknown;

export interface MemorySyncOptions {
  error(error: Error): unknown;
  success(value?: unknown): unknown;
}

export interface MemoryCursor {
  limit(value: number): MemoryCursor;
  toJSON(callback: (error: Error | null, value: unknown) => unknown): unknown;
}

export interface MemorySyncInstance<C extends ModelConstructor<Backbone.Model>> {
  id: number;
  id_attribute: string;
  id_type?: unknown;
  is_initialized?: boolean;
  manual_id?: boolean;
  model_type: C;
  schema: object;
  store: MemoryModelJSON[];
  initialize(): void;
  read(model: Backbone.Collection | InstanceType<C>, options: MemorySyncOptions): unknown;
  create(model: InstanceType<C>, options: MemorySyncOptions): unknown;
  update(model: InstanceType<C>, options: MemorySyncOptions): unknown;
  delete(model: InstanceType<C>, options: MemorySyncOptions): unknown;
  deleteCB(model: InstanceType<C> | MemoryModelJSON, callback: MemorySyncErrorCallback): unknown;
  resetSchema(options: object, callback: MemorySyncErrorCallback): unknown;
  cursor(query?: unknown): MemoryCursor;
  destroy(callback: MemorySyncErrorCallback): unknown;
  destroy(query: unknown, callback: MemorySyncErrorCallback): unknown;
  get(id: unknown): MemoryModelJSON | null;
  indexOf(id: unknown): number;
  insertIndexOf(id: unknown): number;
}

export interface MemorySyncConstructor {
  new <C extends ModelConstructor<Backbone.Model>>(modelType: C): MemorySyncInstance<C>;
}

export interface SyncFactory {
  <M extends Backbone.Model>(modelType: ModelConstructor<M>): ModelSync;
  <C extends Backbone.Collection>(collectionType: CollectionConstructor<C>): CollectionSync;
  Cursor: new (...args: unknown[]) => object;
  Sync: MemorySyncConstructor;
  capabilities(url?: string): MemoryCapabilities;
}

export interface RuntimeUtils extends RuntimeIterationUtils {
  bbCallback(callback: (error: Error | null, model?: unknown, response?: unknown, options?: object) => unknown): Record<string, unknown>;
  configureCollectionModelType<S>(collectionType: CollectionConstructor<Backbone.Collection>, sync: S): ModelConstructor<Backbone.Model>;
  configureModelType(modelType: ModelConstructor<Backbone.Model>): unknown;
  dataId(data: unknown): unknown;
  dataIsSameModel(left: unknown, right: unknown): boolean;
  dataToModel<M extends Backbone.Model>(data: unknown, modelType: ModelConstructor<M>): M | M[] | null;
  fieldCompare(left: Backbone.Model, right: Backbone.Model, fields: unknown[]): number;
  findOrGenerateModelName(modelType: ModelConstructor<Backbone.Model>): string;
  get(object: object, key: string, defaultValue?: unknown): unknown;
  isCollection(value: unknown): unknown;
  isModel(value: unknown): unknown;
  isSorted(models: Backbone.Model[], fields: unknown[]): boolean;
  jsonFieldCompare(left: Record<string, unknown>, right: Record<string, unknown>, fields: unknown[]): number;
  modelJSONSave(modelJSON: Record<string, unknown>, modelType: ModelConstructor<Backbone.Model>, callback: ResultCallback<unknown>): unknown;
  orSet(object: object, key: string, value: unknown): unknown;
  patchRemove: PatchRemove;
  patchRemoveByJSON: PatchRemove;
  presaveBelongsToRelationships(model: Backbone.Model, callback: ErrorCallback): unknown;
  resetSchemas(modelTypes: Array<ModelConstructor<Backbone.Model>>, callback: ErrorCallback): unknown;
  resetSchemas(modelTypes: Array<ModelConstructor<Backbone.Model>>, options: object, callback: ErrorCallback): unknown;
  set(object: object, key: string, value: unknown): unknown;
  unset(object: object, key: string): boolean;
  updateModel<M extends Backbone.Model>(target: M, source: Backbone.Model | Record<string, unknown>): M;
  updateOrNew<M extends Backbone.Model>(data: unknown, modelType: ModelConstructor<M>): M | null;
  wrapOptions(options: unknown, callback: (error: Error | null, model?: unknown, response?: unknown, options?: object) => unknown): Record<string, unknown>;
}

export interface RuntimeUtilsConstructor extends RuntimeUtils {
  (): void;
  new (): object;
}

export interface RuntimeModelCache {
  configure(options?: unknown): unknown;
  configureSync(modelType: ModelConstructor<Backbone.Model>, sync: ModelSync): ModelSync;
  reset(): unknown;
}

export interface BackboneORMRuntime {
  BaseConvention: NamingConventionConstructor;
  Backbone: typeof Backbone;
  ConnectionPool: ConnectionPoolInstance;
  Cursor: CursorConstructor;
  DatabaseURL: DatabaseURLConstructor;
  DateUtils: DateUtilsConstructor;
  Fabricator: FabricatorConstructor;
  JSONUtils: JSONUtilsConstructor;
  MemoryStore: typeof MemoryStore;
  Queue: QueueConstructor;
  Schema: SchemaConstructor;
  TestUtils: TestUtilsConstructor;
  Utils: RuntimeUtilsConstructor;
  configureModel<C extends ModelConstructor<Backbone.Model>>(modelType: C): ConfiguredModelConstructor<C>;
  configure(options?: object): unknown[];
  model_cache: RuntimeModelCache;
  naming_conventions: NamingConvention;
  sync: SyncFactory;
  _: unknown;
  [key: string]: unknown;
}
