import Backbone from 'backbone';
import BackboneORM, {
  type AdapterSync,
  type ConnectionDisposer,
  type ConnectionPoolInstance,
  type CursorInstance,
  configureModel,
  type DatabaseURLConstructor,
  type DateUtilsConstructor,
  type FabricatorRequiredAttributeInfo,
  type FabricatorRequiredModelConstructor,
  type NamingConvention,
  type ORMModelConstructor,
  type PatchRemove,
  type PatchRemoveModelConstructor,
  type QueueConstructor,
  type Relation,
  type RuntimeJSONUtils,
  type SchemaInstance,
} from 'backbone-orm';
import NodeUMD, { configureModel as configureUMDModel } from 'backbone-orm/umd';
import type { CursorCallback, EachOptions, IterationCallback } from 'backbone-orm';
import type { DurationUnit, IntervalIterator, IntervalOptions, IntervalQuery, IntervalRange, IterationInfo } from 'backbone-orm';
import type { FindOneNearestDateOptions } from 'backbone-orm';

interface AuthorAttributes {
  name: string;
}

const umdRuntime: typeof BackboneORM = NodeUMD;
const umdConfigureModel: typeof configureModel = configureUMDModel;
const rootUtilsCall: void = BackboneORM.Utils();
const rootUtilsInstance: object = new BackboneORM.Utils();
const umdUtilsCall: void = NodeUMD.Utils();
const umdUtilsInstance: object = new NodeUMD.Utils();

void [umdRuntime, umdConfigureModel, rootUtilsCall, rootUtilsInstance, umdUtilsCall, umdUtilsInstance];

type Author = Backbone.Model<AuthorAttributes>;

const Author: ORMModelConstructor<Author> = Backbone.Model.extend({
  model_name: 'TypedAuthor',
  schema() {
    return { name: 'String' };
  },
});
Author.prototype.sync = BackboneORM.sync(Author);
const authorSchema: SchemaInstance = new BackboneORM.Schema(Author, { id: { type: 'String' } });
authorSchema.initialize();
const authorColumns: string[] = authorSchema.columns();
const authorNameType: unknown = authorSchema.type('name');
const authorRelation: Relation | undefined = authorSchema.relation('missing');
const schemaSetter: SchemaInstance = authorSchema.type('name', 'Text');

const allAuthors: Promise<Author[]> = Author.find();
const namedAuthors: Promise<Author[]> = Author.find({ name: 'Ada' });
Author.find((error, authors) => {
  const first: Author | undefined = authors?.[0];
  void error;
  void first;
});
Author.find({ name: 'Ada' }, (error, authors) => {
  const first: Author | undefined = authors?.[0];
  void error;
  void first;
});

void [allAuthors, namedAuthors, authorColumns, authorNameType, authorRelation, schemaSetter];

class NativeAuthor extends Backbone.Model<AuthorAttributes> {
  get model_name() {
    return 'TypedNativeAuthor';
  }

  schema() {
    return { name: 'String' };
  }
}

const ConfiguredNativeAuthor = configureModel(NativeAuthor);
const directMemorySync = new BackboneORM.sync.Sync(NativeAuthor);
const directMemoryModelType: typeof NativeAuthor = directMemorySync.model_type;
const nativeAuthors: Promise<NativeAuthor[]> = ConfiguredNativeAuthor.find({ name: 'Grace' });
const nativeCursor: CursorInstance<NativeAuthor> = ConfiguredNativeAuthor.cursor({ name: 'Grace' });
const nativeDatabase: unknown = ConfiguredNativeAuthor.db();
const nativeResetRequest: unknown = ConfiguredNativeAuthor.resetSchema({}, (error) => error);
const nativeDestroyRequest: unknown = ConfiguredNativeAuthor.destroy({ name: 'Grace' }, (error) => error);
ConfiguredNativeAuthor.count({ name: 'Grace' }, (error, count) => [error, count]);
ConfiguredNativeAuthor.exists((error, exists) => [error, exists]);
ConfiguredNativeAuthor.all((error, authors) => [error, authors]);
ConfiguredNativeAuthor.findOne({ name: 'Grace' }, (error, author) => [error, author]);
ConfiguredNativeAuthor.findOrCreate({ name: 'Grace' }, (error, author) => [error, author]);
directMemorySync.cursor({}).toJSON((error, result) => {
  if (error) return error;
  if (Array.isArray(result)) {
    const firstId: unknown = result[0] && typeof result[0] === 'object' && 'id' in result[0] ? result[0].id : undefined;
    void firstId;
  } else if (typeof result === 'number') {
    const count: number = result;
    void count;
  } else if (result && typeof result === 'object' && 'id' in result) {
    const oneId: unknown = result.id;
    void oneId;
  }
});
ConfiguredNativeAuthor.find((_error, authors) => {
  const first: NativeAuthor | undefined = authors?.[0];
  void first;
});

void [directMemoryModelType, nativeAuthors, nativeCursor, nativeDatabase, nativeResetRequest, nativeDestroyRequest];

interface OwnedConnection {
  readonly id: string;
  close(callback: (error?: Error | null) => void): void;
}

const pool: ConnectionPoolInstance = BackboneORM.ConnectionPool;
const databaseURL: DatabaseURLConstructor = BackboneORM.DatabaseURL;
const queue: QueueConstructor = BackboneORM.Queue;
const dateUtils: DateUtilsConstructor = BackboneORM.DateUtils;
const jsonUtils: RuntimeJSONUtils = BackboneORM.JSONUtils;
const connection: OwnedConnection = {
  id: 'typed-connection',
  close(callback) {
    callback(null);
  },
};
const disposer: ConnectionDisposer<OwnedConnection> = (value, callback) => value.close(callback);
const poolSetResult: ConnectionPoolInstance = pool.setOwned('typed-connection', connection, disposer);
const uncheckedConnection: unknown = pool.get('typed-connection');
const disposedConnection: Promise<void> = pool.dispose('typed-connection');
const disposedAll: Promise<void> = pool.disposeAll();
const callbackDisposeResult: void = pool.dispose('typed-connection', (error) => {
  void error;
});
const parsedDatabase = new databaseURL('sqlite3:///typed_table');
const formattedDatabase: string = parsedDatabase.format();
const parsedModelName: string | null = parsedDatabase.modelName();
const activeNaming: NamingConvention = BackboneORM.naming_conventions;
class TypedNamingConvention extends BackboneORM.BaseConvention {}
const configureReturns: unknown[] = BackboneORM.configure({ naming_conventions: TypedNamingConvention });
BackboneORM.configure({ naming_conventions: 'default' });
const runtimeQueue = new queue(1);
runtimeQueue.defer((callback) => callback(null));
runtimeQueue.await((error) => {
  void error;
});
const serialized: string | undefined = jsonUtils.stringify({ id: 1 });
const legacyHourMilliseconds: number = dateUtils.durationAsMilliseconds(1, 'hours');
const fabricatedAuthors: Author[] = BackboneORM.Fabricator.new(Author, 2, { name: () => 'Fabricated' });
const fabricatorCreateRequest: unknown = BackboneORM.Fabricator.create(Author, 1, { name: 'Created' }, (error, authors) => {
  const first: Author | undefined = authors[0];
  void [error, first];
});
const fixedFabricatedName: () => string = BackboneORM.Fabricator.value('fixed');
const fabricatedSequence: () => number = BackboneORM.Fabricator.increment(1);
const immediateFabricatedId: string = BackboneORM.Fabricator.uniqueId();
const generatedFabricatedId: () => string = BackboneORM.Fabricator.uniqueString('typed_');
const fabricatedNow: Date = BackboneORM.Fabricator.date();
const fabricatedDates: () => Date = BackboneORM.Fabricator.date(new Date('2020-01-01T00:00:00.000Z'), 5);
const testOptionTags: string = BackboneORM.TestUtils.optionSets()[0].$tags;
type Handler = () => string;
class HandlerModel extends Backbone.Model<{ handler: Handler }> {}
const handler: Handler = () => 'handled';
const generatedHandlerModels: HandlerModel[] = BackboneORM.Fabricator.new(HandlerModel, 1, { handler: () => handler });
const fixedHandlerModels: HandlerModel[] = BackboneORM.Fabricator.new(HandlerModel, 1, { handler: BackboneORM.Fabricator.value(handler) });
class RequiredAttributesModel extends Backbone.Model<{ name: string }> {
  constructor(attributes: { name: string }) {
    super(attributes);
  }
}
const requiredAttributeModels: RequiredAttributesModel[] = BackboneORM.Fabricator.new(RequiredAttributesModel, 1, { name: 'Required' });
const createdRequiredAttributes: unknown = BackboneORM.Fabricator.create(RequiredAttributesModel, 1, { name: () => 'Created required' }, (_error, models) => models[0]);
const publicRequiredAttributes: FabricatorRequiredAttributeInfo<{ name: string }> = { name: () => 'Public required' };
const publicRequiredConstructor: FabricatorRequiredModelConstructor<{ name: string }, RequiredAttributesModel> = RequiredAttributesModel;
const publicRequiredModels: RequiredAttributesModel[] = BackboneORM.Fabricator.new(publicRequiredConstructor, 1, publicRequiredAttributes);
const publicRequiredCreateRequest: unknown = BackboneORM.Fabricator.create(publicRequiredConstructor, 1, publicRequiredAttributes, (_error, models) => {
  const model: RequiredAttributesModel | undefined = models[0];
  return model;
});

void [
  poolSetResult,
  uncheckedConnection,
  disposedConnection,
  disposedAll,
  callbackDisposeResult,
  formattedDatabase,
  parsedModelName,
  activeNaming,
  configureReturns,
  serialized,
  legacyHourMilliseconds,
  fabricatedAuthors,
  fabricatorCreateRequest,
  fixedFabricatedName,
  fabricatedSequence,
  immediateFabricatedId,
  generatedFabricatedId,
  fabricatedNow,
  fabricatedDates,
  testOptionTags,
  generatedHandlerModels,
  fixedHandlerModels,
  requiredAttributeModels,
  createdRequiredAttributes,
  publicRequiredModels,
  publicRequiredCreateRequest,
];

interface AdapterDatabase {
  readonly kind: 'adapter-database';
}

declare const adapterSync: AdapterSync<CursorInstance<Author>, AdapterDatabase>;
const adapterCursor: CursorInstance<Author> = adapterSync('cursor', { name: 'Ada' });
const adapterDatabase: AdapterDatabase = adapterSync('db');
const adapterSchema: SchemaInstance | undefined = adapterSync('schema');
const adapterTable: string | undefined = adapterSync('tableName');
const adapterRemote: boolean = adapterSync('isRemote');
const resetRequest: unknown = adapterSync('resetSchema', {}, (error) => error);
const destroyRequest: unknown = adapterSync('destroy', { name: 'Ada' }, (error) => error);
const readRequest: unknown = adapterSync('read', new Backbone.Model(), {});
adapterCursor.limit(1).offset(0).sort('name').select('id', 'name').whiteList(['id', 'name']).include('books').unique('name').values('id').ids();
adapterCursor.toJSON((error, result) => [error, result]);
adapterCursor.toModels((error, models) => [error, models]);

declare const patchModelType: PatchRemoveModelConstructor<Author>;
const patchRemove: PatchRemove = BackboneORM.Utils.patchRemove;
const patchRequest: unknown = patchRemove(patchModelType, new Backbone.Model(), (error) => error);
const updatedOrNewAuthor: Author | null = BackboneORM.Utils.updateOrNew({ name: 'Ada' }, Author);

void [adapterDatabase, adapterSchema, adapterTable, adapterRemote, resetRequest, destroyRequest, readRequest, patchRequest, updatedOrNewAuthor];

class ExistingFindAuthor extends Backbone.Model<AuthorAttributes> {
  static readonly category = 'existing-find';
  readonly token: string;

  constructor(attributes: AuthorAttributes, token: string) {
    super(attributes);
    this.token = token;
  }

  get model_name() {
    return 'TypedExistingFindAuthor';
  }

  schema() {
    return { name: 'String' };
  }

  static find(): string {
    return 'custom';
  }
}

const ConfiguredExistingFindAuthor = configureModel(ExistingFindAuthor);
const existingFindAuthors: Promise<ExistingFindAuthor[]> = ConfiguredExistingFindAuthor.find();
const configuredInstance = new ConfiguredExistingFindAuthor({ name: 'Octavia' }, 'retained-constructor');
const configuredCategory: 'existing-find' = ConfiguredExistingFindAuthor.category;

class InheritedConfiguredAuthor extends ConfiguredExistingFindAuthor {
  static readonly inheritedCategory = 'inherited';
}

const ConfiguredInheritedAuthor = configureModel(InheritedConfiguredAuthor);
const inheritedAuthors: Promise<InheritedConfiguredAuthor[]> = ConfiguredInheritedAuthor.find();
const inheritedInstance = new ConfiguredInheritedAuthor({ name: 'Ursula' }, 'retained-inheritance');
const inheritedCategory: 'inherited' = ConfiguredInheritedAuthor.inheritedCategory;

void [existingFindAuthors, configuredInstance, configuredCategory, inheritedAuthors, inheritedInstance, inheritedCategory];

const relatedCallbackReturn: unknown = configuredInstance.fetchRelated((error) => {
  const callbackError: Error | null | undefined = error;
  return callbackError?.message;
});
const namedRelatedReturn: unknown = configuredInstance.fetchRelated('children', () => 'completion');
const listedRelatedReturn: unknown = configuredInstance.fetchRelated(['children', 'profile'], () => undefined);
const prototypeRelatedReturn: unknown = ConfiguredExistingFindAuthor.prototype.fetchRelated(() => undefined);
const inheritedRelatedReturn: unknown = inheritedInstance.fetchRelated(() => undefined);
const configuredName: string | undefined = configuredInstance.get('name');
const configuredToken: string = configuredInstance.token;
const retainedInstance: ExistingFindAuthor = configuredInstance;

void [relatedCallbackReturn, namedRelatedReturn, listedRelatedReturn, prototypeRelatedReturn, inheritedRelatedReturn, configuredName, configuredToken, retainedInstance];

class RelatedAuthor extends NativeAuthor {
  static readonly category = 'related-author';
  displayName(): string {
    const name = this.get('name');
    if (name === undefined) throw new Error('RelatedAuthor requires a name');
    return name;
  }
}
const ConfiguredRelatedAuthor = configureUMDModel(RelatedAuthor);
const relatedAuthor = new ConfiguredRelatedAuthor({ name: 'Toni' });
const relatedDisplayName: string = relatedAuthor.displayName();
const relatedCategory: 'related-author' = ConfiguredRelatedAuthor.category;
const relatedAuthors: Promise<RelatedAuthor[]> = ConfiguredRelatedAuthor.find({ name: 'Toni' });
relatedAuthor.fetchRelated('children', () => undefined);

void [relatedDisplayName, relatedCategory, relatedAuthors];

class PrivateRelatedAuthor extends ExistingFindAuthor {
  private readonly privateLabel = 'private-related-author';
  label(): string {
    return this.privateLabel;
  }
}
const ConfiguredPrivateRelatedAuthor = configureModel(PrivateRelatedAuthor);
const privateRelatedAuthor = new ConfiguredPrivateRelatedAuthor({ name: 'Nella' }, 'private-constructor');
const retainedPrivateInstance: PrivateRelatedAuthor = privateRelatedAuthor;
const privateRelatedLabel: string = privateRelatedAuthor.label();
const privateRelatedAuthors: Promise<PrivateRelatedAuthor[]> = ConfiguredPrivateRelatedAuthor.find({ name: 'Nella' });
privateRelatedAuthor.fetchRelated(() => undefined);

void [retainedPrivateInstance, privateRelatedLabel, privateRelatedAuthors];

const configuredModelLoaded: boolean = configuredInstance.isLoaded();
const configuredRelationLoaded: boolean = configuredInstance.isLoaded('children');
const optionalLoadKey: string | undefined = undefined;
const optionalKeyLoaded: boolean = configuredInstance.isLoaded(optionalLoadKey);
const configuredModelLoadReturn: boolean | undefined = configuredInstance.setLoaded(false);
const configuredRelationLoadReturn: boolean | undefined = configuredInstance.setLoaded('children', true);
const prototypeLoadReturn: boolean | undefined = ConfiguredExistingFindAuthor.prototype.setLoaded(true);
const inheritedLoaded: boolean = inheritedInstance.isLoaded('children');
const inheritedLoadReturn: boolean | undefined = inheritedInstance.setLoaded('children', false);
const umdLoaded: boolean = relatedAuthor.isLoaded();
const umdLoadReturn: boolean | undefined = relatedAuthor.setLoaded(true);
const privateLoaded: boolean = privateRelatedAuthor.isLoaded();
const privateLoadReturn: boolean | undefined = privateRelatedAuthor.setLoaded('children', true);
const retainedLoadInstance: ExistingFindAuthor = configuredInstance;
const retainedPrivateLoadInstance: PrivateRelatedAuthor = privateRelatedAuthor;
const loadStateAuthors: Promise<ExistingFindAuthor[]> = ConfiguredExistingFindAuthor.find();
const loadStatePrivateAuthors: Promise<PrivateRelatedAuthor[]> = ConfiguredPrivateRelatedAuthor.find();

void [configuredModelLoaded, configuredRelationLoaded, optionalKeyLoaded, configuredModelLoadReturn, configuredRelationLoadReturn, prototypeLoadReturn, inheritedLoaded, inheritedLoadReturn, umdLoaded, umdLoadReturn, privateLoaded, privateLoadReturn, retainedLoadInstance, retainedPrivateLoadInstance, loadStateAuthors, loadStatePrivateAuthors];

const memoryStore = new BackboneORM.MemoryStore({ max: 10, max_age: 1000 });
const defaultMemoryStore = new BackboneORM.MemoryStore();
const nullableMemoryStore = new BackboneORM.MemoryStore(null);
const optionalMemoryStore = new BackboneORM.MemoryStore(undefined);
const memoryStoreValue = { _orm_never_cache: false, label: 'typed-cache-value' };
const memoryStoreSetResult: unknown = memoryStore.set('typed-cache', memoryStoreValue, (error, value) => {
  const callbackError: null = error;
  const cacheExcluded: boolean | undefined = value._orm_never_cache;
  return [callbackError, cacheExcluded];
});
const neverCachedSetResult: unknown = memoryStore.set('uncached', { _orm_never_cache: true }, () => 'not-stored');
const memoryStoreRead: unknown = memoryStore.get('typed-cache', (error, value) => {
  const callbackError: null = error;
  const callbackValue: unknown = value;
  return [callbackError, callbackValue];
});
const memoryStoreDestroyResult: typeof memoryStore = memoryStore.destroy('typed-cache', () => 'destroyed');
const memoryStoreDeleteResult: typeof memoryStore = memoryStore.del('typed-cache');
const memoryStoreResetResult: typeof memoryStore = memoryStore.reset(() => 'reset');
const memoryStoreIterationResult: unknown = memoryStore.forEach((value, key, cache) => {
  const uncheckedValue: unknown = value;
  const uncheckedKey: unknown = key;
  const uncheckedCacheRead: unknown = cache.get(key);
  return [uncheckedValue, uncheckedKey, uncheckedCacheRead];
});
const { set: boundSet, get: boundGet, destroy: boundDestroy, reset: boundReset, forEach: boundForEach } = memoryStore;
const boundSetResult: unknown = boundSet(0, memoryStoreValue);
const boundRead: unknown = boundGet(0);
const boundDestroyResult: typeof memoryStore = boundDestroy(0);
const boundResetResult: typeof memoryStore = boundReset();
const boundIterationResult: unknown = boundForEach((value, key) => [value, key]);

void [
  defaultMemoryStore,
  nullableMemoryStore,
  optionalMemoryStore,
  memoryStoreSetResult,
  neverCachedSetResult,
  memoryStoreRead,
  memoryStoreDestroyResult,
  memoryStoreDeleteResult,
  memoryStoreResetResult,
  memoryStoreIterationResult,
  boundSetResult,
  boundRead,
  boundDestroyResult,
  boundResetResult,
  boundIterationResult,
];

const eachOptions: EachOptions = { fetch: 200, json: false, threads: 1 };
const eachRequest: unknown = ConfiguredNativeAuthor.each((model, next) => {
  const author: NativeAuthor = model;
  const name: string | undefined = author.get('name');
  const continuation: IterationCallback = next;
  continuation(null);
  return name;
}, (error, count) => {
  const completionError: Error | null = error;
  const processedCount: number | undefined = count;
  return [completionError, processedCount];
});
const eachCompletion: CursorCallback<number> = (error, count) => [error, count];
const eachCRequest: unknown = ConfiguredNativeAuthor.eachC(eachCompletion, (model, next) => {
  const author: NativeAuthor = model;
  next();
  return author;
});
ConfiguredNativeAuthor.each({ name: 'Ada', $each: { json: false, fetch: 200, threads: 1 } }, (model, next) => {
  const name: string | undefined = model.get('name');
  next(null);
  return name;
}, eachCompletion);
ConfiguredNativeAuthor.eachC({ name: 'Ada', $each: { json: false, fetch: 200, threads: 1 } }, eachCompletion, (model, next) => {
  const author: NativeAuthor = model;
  return next(author.get('name') ? null : new Error('Missing name'));
});
ConfiguredNativeAuthor.each({ $each: { json: true }, $values: 'name' }, (value, next) => {
  const uncheckedValue: unknown = value;
  next();
  return typeof uncheckedValue === 'string' ? uncheckedValue.toUpperCase() : uncheckedValue;
}, eachCompletion);
ConfiguredNativeAuthor.eachC({ $each: { json: true }, $values: 'name' }, eachCompletion, (value, next) => {
  const uncheckedValue: unknown = value;
  next();
  return uncheckedValue;
});
declare const eachJsonMode: boolean;
declare const eachQuery: Record<string, unknown>;
ConfiguredNativeAuthor.each({ $each: { json: eachJsonMode } }, (value, next) => {
  const uncheckedValue: unknown = value;
  next();
  return uncheckedValue;
}, eachCompletion);
ConfiguredNativeAuthor.eachC(eachQuery, eachCompletion, (value, next) => {
  const uncheckedValue: unknown = value;
  next();
  return uncheckedValue;
});
ConfiguredNativeAuthor.each({ name: 'Ada', $each: eachOptions }, (value, next) => {
  const uncheckedValue: unknown = value;
  next();
  return uncheckedValue;
}, eachCompletion);
ConfiguredPrivateRelatedAuthor.each((model, next) => {
  const privateAuthor: PrivateRelatedAuthor = model;
  const token: string = privateAuthor.token;
  next();
  return [privateAuthor.label(), token];
}, eachCompletion);
ConfiguredInheritedAuthor.eachC(eachCompletion, (model, next) => {
  const inheritedAuthor: InheritedConfiguredAuthor = model;
  next();
  return inheritedAuthor.token;
});
ConfiguredRelatedAuthor.each((model, next) => {
  const umdAuthor: RelatedAuthor = model;
  next();
  return umdAuthor.displayName();
}, eachCompletion);

class ExistingEachAuthor extends NativeAuthor {
  static readonly category = 'existing-each';

  static each(): string {
    return 'custom-each';
  }

  static eachC(): string {
    return 'custom-eachC';
  }
}

const ConfiguredExistingEachAuthor = configureModel(ExistingEachAuthor);
const existingEachAuthor: ExistingEachAuthor = new ConfiguredExistingEachAuthor({ name: 'Ada' });
const existingEachCategory: 'existing-each' = ConfiguredExistingEachAuthor.category;
const replacedEachRequest: unknown = ConfiguredExistingEachAuthor.each((model, next) => {
  const author: ExistingEachAuthor = model;
  next();
  return author;
}, eachCompletion);
const replacedEachCRequest: unknown = ConfiguredExistingEachAuthor.eachC(eachCompletion, (model, next) => {
  const author: ExistingEachAuthor = model;
  next();
  return author;
});

void [eachOptions, eachRequest, eachCRequest, existingEachAuthor, existingEachCategory, replacedEachRequest, replacedEachCRequest];

const intervalRange: IntervalRange = {
  $gt: new Date('2020-01-01T00:00:00Z'),
  $gte: new Date('2020-01-01T00:00:00Z'),
  $lt: new Date('2020-02-01T00:00:00Z'),
  $lte: new Date('2020-02-01T00:00:00Z'),
  start: new Date('2020-01-01T00:00:00Z'),
  end: new Date('2020-02-01T00:00:00Z'),
};
const intervalOptions: IntervalOptions = { key: 'created_at', type: 'days', length: 2, range: intervalRange, applicationOption: true };
const intervalQuery: IntervalQuery = { status: 'completed', $interval: { ...intervalOptions, key: 'created_at', type: 'days' } };
const intervalCompletion: IterationCallback = (error) => {
  const completionError: Error | null | undefined = error;
  return completionError;
};
const intervalRequest: unknown = ConfiguredNativeAuthor.interval(intervalQuery, (query, information, next) => {
  const selectedQuery: Record<string, unknown> = query;
  const status: unknown = selectedQuery.status;
  const ownerInfo: IterationInfo = information;
  const index: number | undefined = ownerInfo.index;
  const start: Date | undefined = ownerInfo.start;
  const end: Date | undefined = ownerInfo.end;
  const first: Date | undefined = ownerInfo.first;
  const last: Date | undefined = ownerInfo.last;
  const range: IntervalRange = ownerInfo.range;
  const continuation: IterationCallback = next;
  if (start) start.getTime();
  if (end) end.getTime();
  if (first) first.getTime();
  if (last) last.getTime();
  information.index = 0;
  information.range.start = new Date('2020-01-01T00:00:00Z');
  continuation(null);
  return [status, index, range];
}, intervalCompletion);
const intervalIterator: IntervalIterator = (query, information, next) => {
  const selectedQuery: Record<string, unknown> = query;
  const start: Date | undefined = information.range.start;
  const key: string | undefined = information.key;
  information.end = new Date('2020-02-01T00:00:00Z');
  next();
  return [selectedQuery, start, key];
};
const intervalCRequest: unknown = ConfiguredNativeAuthor.intervalC(intervalQuery, intervalCompletion, intervalIterator);
const intervalUnits: DurationUnit[] = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
for (const type of intervalUnits) {
  ConfiguredNativeAuthor.interval({ name: 'Ada', $interval: { key: 'created_at', type } }, intervalIterator, intervalCompletion);
}
ConfiguredPrivateRelatedAuthor.interval(intervalQuery, intervalIterator, intervalCompletion);
ConfiguredInheritedAuthor.intervalC(intervalQuery, intervalCompletion, intervalIterator);
ConfiguredRelatedAuthor.interval(intervalQuery, intervalIterator, intervalCompletion);
const intervalPrivateAuthor: PrivateRelatedAuthor = new ConfiguredPrivateRelatedAuthor({ name: 'Nella' }, 'interval-private');
const intervalInheritedAuthor: InheritedConfiguredAuthor = new ConfiguredInheritedAuthor({ name: 'Ursula' }, 'interval-inherited');
const intervalUMDAuthor: RelatedAuthor = new ConfiguredRelatedAuthor({ name: 'Toni' });
const intervalInheritedCategory: 'inherited' = ConfiguredInheritedAuthor.inheritedCategory;
const intervalUMDCategory: 'related-author' = ConfiguredRelatedAuthor.category;

class ExistingIntervalAuthor extends NativeAuthor {
  static readonly category = 'existing-interval';

  static interval(): string {
    return 'custom-interval';
  }

  static intervalC(): string {
    return 'custom-intervalC';
  }
}

const ConfiguredExistingIntervalAuthor = configureModel(ExistingIntervalAuthor);
const existingIntervalAuthor: ExistingIntervalAuthor = new ConfiguredExistingIntervalAuthor({ name: 'Ada' });
const existingIntervalCategory: 'existing-interval' = ConfiguredExistingIntervalAuthor.category;
const replacedIntervalRequest: unknown = ConfiguredExistingIntervalAuthor.interval(intervalQuery, intervalIterator, intervalCompletion);
const replacedIntervalCRequest: unknown = ConfiguredExistingIntervalAuthor.intervalC(intervalQuery, intervalCompletion, intervalIterator);

void [
  intervalRange,
  intervalOptions,
  intervalRequest,
  intervalCRequest,
  intervalPrivateAuthor,
  intervalInheritedAuthor,
  intervalUMDAuthor,
  intervalInheritedCategory,
  intervalUMDCategory,
  existingIntervalAuthor,
  existingIntervalCategory,
  replacedIntervalRequest,
  replacedIntervalCRequest,
];

const nearestDate = new Date('2020-01-01T00:00:00Z');
const nearestDateOptions: FindOneNearestDateOptions = { key: 'created_at', reverse: 'legacy-truthy', applicationOption: true };
const nearestDateQuery: Record<string, unknown> = { name: 'Ada', created_at: { $gte: new Date('2019-01-01T00:00:00Z') } };
const nearestDateCompletion: CursorCallback<NativeAuthor | null> = (error, model) => {
  const completionError: Error | null = error;
  const result: NativeAuthor | null | undefined = model;
  if (model) {
    const name: string | undefined = model.get('name');
    return name;
  }
  return [completionError, result];
};
const nearestDateRequest: unknown = ConfiguredNativeAuthor.findOneNearestDate(nearestDate, { key: 'created_at' }, nearestDateCompletion);
const nearestDateQueryRequest: unknown = ConfiguredNativeAuthor.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateQuery, nearestDateCompletion);
declare const nearestDateReverse: unknown;
for (const reverse of [true, false, 1, 0, 'reverse', '', null, { enabled: true }, nearestDateReverse]) {
  ConfiguredNativeAuthor.findOneNearestDate(nearestDate, { key: 'created_at', reverse }, {}, nearestDateCompletion);
}
ConfiguredPrivateRelatedAuthor.findOneNearestDate(nearestDate, nearestDateOptions, (error, model) => {
  const privateAuthor: PrivateRelatedAuthor | null | undefined = model;
  return [error, privateAuthor?.label(), privateAuthor?.token];
});
ConfiguredInheritedAuthor.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateQuery, (error, model) => {
  const inheritedAuthor: InheritedConfiguredAuthor | null | undefined = model;
  return [error, inheritedAuthor?.token];
});
ConfiguredRelatedAuthor.findOneNearestDate(nearestDate, nearestDateOptions, (error, model) => {
  const umdAuthor: RelatedAuthor | null | undefined = model;
  return [error, umdAuthor?.displayName()];
});
const nearestDatePrivateAuthor: PrivateRelatedAuthor = new ConfiguredPrivateRelatedAuthor({ name: 'Nella' }, 'nearest-private');
const nearestDateInheritedAuthor: InheritedConfiguredAuthor = new ConfiguredInheritedAuthor({ name: 'Ursula' }, 'nearest-inherited');
const nearestDateUMDAuthor: RelatedAuthor = new ConfiguredRelatedAuthor({ name: 'Toni' });
const nearestDateInheritedCategory: 'inherited' = ConfiguredInheritedAuthor.inheritedCategory;
const nearestDateUMDCategory: 'related-author' = ConfiguredRelatedAuthor.category;

class ExistingNearestDateAuthor extends NativeAuthor {
  static readonly category = 'existing-nearest-date';

  static findOneNearestDate(): string {
    return 'custom-nearest-date';
  }
}

const ConfiguredExistingNearestDateAuthor = configureModel(ExistingNearestDateAuthor);
const existingNearestDateAuthor: ExistingNearestDateAuthor = new ConfiguredExistingNearestDateAuthor({ name: 'Ada' });
const existingNearestDateCategory: 'existing-nearest-date' = ConfiguredExistingNearestDateAuthor.category;
const replacedNearestDateRequest: unknown = ConfiguredExistingNearestDateAuthor.findOneNearestDate(nearestDate, nearestDateOptions, (error, model) => {
  const author: ExistingNearestDateAuthor | null | undefined = model;
  return [error, author];
});
const replacedNearestDateQueryRequest: unknown = ConfiguredExistingNearestDateAuthor.findOneNearestDate(nearestDate, nearestDateOptions, nearestDateQuery, nearestDateCompletion);

void [nearestDateRequest, nearestDateQueryRequest, nearestDatePrivateAuthor, nearestDateInheritedAuthor, nearestDateUMDAuthor, nearestDateInheritedCategory, nearestDateUMDCategory, existingNearestDateAuthor, existingNearestDateCategory, replacedNearestDateRequest, replacedNearestDateQueryRequest];
