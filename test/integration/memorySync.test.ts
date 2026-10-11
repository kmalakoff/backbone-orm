import assert from 'assert';
import Backbone from 'backbone';
import BackboneORM from 'backbone-orm';

interface TestAttributes extends Backbone.ObjectHash {
  _id?: number | string;
  group?: string;
  id?: number | string;
  name?: string;
}

type TestModel = Backbone.Model<TestAttributes>;
type ModelJSON = Record<string, unknown> & { id?: unknown };
type SyncFunction = Backbone.Model['sync'];

interface DirectMemorySync {
  deleteCB(model: TestModel | ModelJSON, callback: (error?: Error | null) => unknown): unknown;
  is_initialized?: boolean;
  model_type: TestModelConstructor;
  receiverProbe?: (value: string) => object;
  schema: { is_initialized?: boolean };
  store: ModelJSON[];
  cursor(query?: unknown): { toJSON(callback: (error: Error | null, value: unknown) => unknown): unknown };
  [key: string]: unknown;
}

interface CacheDispatch {
  wrapped_sync_fn: SyncFunction;
}

interface CacheStore {
  get(id: number | string): TestModel | undefined;
}

interface TestModelConstructor {
  new (attributes?: TestAttributes): TestModel;
  cache?: CacheStore;
  model_name?: string;
  prototype: TestModel;
  store?: ModelJSON[];
}

interface LegacyPersistenceModel {
  save(callback: (error: Error | null) => void): unknown;
  set(key: string, value: unknown): TestModel;
}

interface DispatchObservation {
  callbackContext: unknown;
  callbackValue: unknown;
  returned: unknown;
}

function createModelType(name: string, schema: object, idAttribute = 'id'): TestModelConstructor {
  class ModelType extends Backbone.Model<TestAttributes> {
    get model_name() {
      return name;
    }

    schema() {
      return schema;
    }
  }
  ModelType.prototype.idAttribute = idAttribute;
  return ModelType;
}

function dispatch(sync: SyncFunction, method: string, ...arguments_: unknown[]): unknown {
  return Reflect.apply(sync, undefined, [method, ...arguments_]);
}

function observeDispatch(sync: SyncFunction, method: string, model: Backbone.Collection<TestModel> | TestModel): DispatchObservation {
  const sentinel = { method };
  let callbackContext: unknown;
  let callbackCount = 0;
  let callbackValue: unknown;
  const options = {
    error(this: object, error: Error) {
      callbackContext = this;
      callbackCount += 1;
      callbackValue = error;
      return sentinel;
    },
    success(this: object, value?: unknown) {
      callbackContext = this;
      callbackCount += 1;
      callbackValue = value;
      return sentinel;
    },
  };
  const returned = dispatch(sync, method, model, options);
  assert.strictEqual(returned, sentinel);
  assert.strictEqual(callbackCount, 1);
  assert.strictEqual(callbackContext, options);
  return { callbackContext, callbackValue, returned };
}

function save(model: TestModel): void {
  let callbackCount = 0;
  let error: Error | null | undefined;
  const returned = (model as TestModel & LegacyPersistenceModel).save((saveError) => {
    callbackCount += 1;
    error = saveError;
  });
  assert.strictEqual(returned, undefined);
  assert.strictEqual(callbackCount, 1);
  assert.ifError(error);
}

describe('TypeScript memory sync', () => {
  beforeEach(() => {
    BackboneORM.configure({ model_cache: { enabled: false } });
  });

  it('owns the public constructor, metadata, dispatch, and receiver binding', () => {
    const ModelType = createModelType('MemorySyncFactoryModel', {});
    const BaseCursor = BackboneORM.Cursor as unknown as new (query: unknown, options: object) => object;
    assert.notStrictEqual(BaseCursor, BackboneORM.sync.Cursor);
    assert.strictEqual(Reflect.get(BackboneORM.Cursor.prototype, 'buildFindQuery'), undefined);
    const baseCursor = new BaseCursor({}, { model_type: ModelType, store: [] });
    assert.strictEqual(typeof Reflect.get(baseCursor, 'toModels'), 'function');
    type LegacyCursorConstructor = {
      new (query: unknown, options: object): object;
      __super__: { constructor: (...arguments_: unknown[]) => unknown };
      prototype: object;
    };
    const LegacyCursor = function legacyCursor(this: object, ...arguments_: unknown[]) {
      LegacyCursor.__super__.constructor.apply(this, arguments_);
    } as unknown as LegacyCursorConstructor;
    LegacyCursor.__super__ = BackboneORM.sync.Cursor.prototype as unknown as LegacyCursorConstructor['__super__'];
    LegacyCursor.prototype = Object.create(BackboneORM.sync.Cursor.prototype);
    const legacyCursor = new LegacyCursor({}, { model_type: ModelType, store: [] });
    assert.ok(legacyCursor instanceof BackboneORM.sync.Cursor);
    assert.strictEqual(typeof Reflect.get(legacyCursor, 'buildFindQuery'), 'function');
    const direct = new BackboneORM.sync.Sync(ModelType);
    assert.strictEqual(direct.model_type, ModelType);

    const sync = BackboneORM.sync(ModelType);
    const memorySync = dispatch(sync, 'sync') as DirectMemorySync;
    assert.ok(memorySync instanceof BackboneORM.sync.Sync);
    assert.strictEqual(memorySync.is_initialized, true);
    assert.strictEqual(memorySync.schema.is_initialized, true);
    assert.strictEqual(dispatch(sync, 'schema'), memorySync.schema);
    assert.strictEqual(dispatch(sync, 'isRemote'), false);
    assert.strictEqual(dispatch(sync, 'tableName'), undefined);
    assert.strictEqual(dispatch(sync, 'unknownMethod'), undefined);

    memorySync.receiverProbe = function receiverProbe(value) {
      return { sameReceiver: this === memorySync, value };
    };
    assert.deepStrictEqual(dispatch(sync, 'receiverProbe', 'receiver-value'), {
      sameReceiver: true,
      value: 'receiver-value',
    });
    memorySync.truthyValue = { value: true };
    assert.throws(() => dispatch(sync, 'truthyValue'), /apply is not a function/);
    memorySync.falsyValue = 0;
    assert.strictEqual(dispatch(sync, 'falsyValue'), undefined);

    const firstCapabilities = BackboneORM.sync.capabilities();
    assert.strictEqual(BackboneORM.sync.capabilities('/ignored'), firstCapabilities);
    assert.deepStrictEqual(firstCapabilities, {
      dynamic: true,
      embed: true,
      json: true,
      manual_ids: true,
      self_reference: true,
      unique: true,
    });
  });

  it('preserves direct CRUD callback returns, contexts, errors, clones, and bound deleteCB', () => {
    const ModelType = createModelType('MemorySyncCrudModel', { name: 'String' });
    const sync = BackboneORM.sync(ModelType);
    const memorySync = dispatch(sync, 'sync') as DirectMemorySync;
    const created = new ModelType({ name: 'created' });
    const createObservation = observeDispatch(sync, 'create', created);
    assert.strictEqual(created.id, 1);
    assert.deepStrictEqual(createObservation.callbackValue, { id: 1, name: 'created' });
    assert.notStrictEqual(createObservation.callbackValue, memorySync.store[0]);

    const readTarget = new ModelType({ id: created.id });
    const readObservation = observeDispatch(sync, 'read', readTarget);
    assert.deepStrictEqual(readObservation.callbackValue, { id: 1, name: 'created' });
    assert.notStrictEqual(readObservation.callbackValue, memorySync.store[0]);

    const collection = new Backbone.Collection<TestModel>([], { model: ModelType });
    const collectionRead = observeDispatch(sync, 'read', collection);
    assert.deepStrictEqual(collectionRead.callbackValue, [{ id: 1, name: 'created' }]);
    assert.notStrictEqual((collectionRead.callbackValue as ModelJSON[])[0], memorySync.store[0]);

    created.set('name', 'updated');
    const updateObservation = observeDispatch(sync, 'update', created);
    assert.deepStrictEqual(updateObservation.callbackValue, { id: 1, name: 'updated' });
    assert.notStrictEqual(updateObservation.callbackValue, memorySync.store[0]);

    const callbackError = new Error('direct callback exception');
    assert.throws(
      () =>
        dispatch(sync, 'read', readTarget, {
          success() {
            throw callbackError;
          },
        }),
      (error) => error === callbackError
    );

    const deleteObservation = observeDispatch(sync, 'delete', created);
    assert.strictEqual(deleteObservation.callbackValue, undefined);
    assert.deepStrictEqual(memorySync.store, []);

    const missingRead = observeDispatch(sync, 'read', new ModelType({ id: 404 }));
    assert.ok(missingRead.callbackValue instanceof Error);
    assert.strictEqual(missingRead.callbackValue.message, 'Model not found with id: 404');
    const missingUpdate = observeDispatch(sync, 'update', new ModelType({ id: 404, name: 'missing' }));
    assert.ok(missingUpdate.callbackValue instanceof Error);
    assert.strictEqual(missingUpdate.callbackValue.message, 'Update cannot create a new model without manual option. Set an id before calling save. Model name: MemorySyncCrudModel. Model: {"id":404,"name":"missing"}');
    const missingDelete = observeDispatch(sync, 'delete', new ModelType({ id: 404 }));
    assert.ok(missingDelete.callbackValue instanceof Error);
    assert.strictEqual(missingDelete.callbackValue.message, 'Model not found. Type: MemorySyncCrudModel. Id: 404');

    const detachedModel = new ModelType({ name: 'detached' });
    observeDispatch(sync, 'create', detachedModel);
    const detachedDelete = memorySync.deleteCB;
    let callbackCount = 0;
    const returned = detachedDelete(detachedModel, (error) => {
      callbackCount += 1;
      assert.ifError(error);
      return 'detached-callback-return';
    });
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(returned, 'detached-callback-return');
  });

  it('preserves automatic, string, manual, and custom idAttribute behavior', () => {
    const StringIdModel = createModelType('MemorySyncStringIdModel', { id: 'String' });
    const stringSync = BackboneORM.sync(StringIdModel);
    const stringModel = new StringIdModel({ name: 'string' });
    observeDispatch(stringSync, 'create', stringModel);
    assert.strictEqual(stringModel.id, '1');

    const ManualIdModel = createModelType('MemorySyncManualIdModel', {
      id: ['Integer', { manual: true }],
    });
    const manualSync = BackboneORM.sync(ManualIdModel);
    const missingId = observeDispatch(manualSync, 'create', new ManualIdModel({ name: 'missing-id' }));
    assert.ok(missingId.callbackValue instanceof Error);
    assert.strictEqual(missingId.callbackValue.message, 'Create should not be called for a manual id. Set an id before calling save. Model name: MemorySyncManualIdModel. Model: {"name":"missing-id"}');
    const manualModel = new ManualIdModel({ id: 27, name: 'manual-id' });
    const manualUpdate = observeDispatch(manualSync, 'update', manualModel);
    assert.deepStrictEqual(manualUpdate.callbackValue, { id: 27, name: 'manual-id' });

    const CustomIdModel = createModelType('MemorySyncCustomIdModel', { id: 'String' }, '_id');
    const customSync = BackboneORM.sync(CustomIdModel);
    const customModel = new CustomIdModel({ name: 'custom-id' });
    observeDispatch(customSync, 'create', customModel);
    assert.strictEqual(customModel.id, '1');
    assert.deepStrictEqual(CustomIdModel.store, [{ _id: '1', name: 'custom-id' }]);
    const customRead = observeDispatch(customSync, 'read', new CustomIdModel({ _id: '1' }));
    assert.deepStrictEqual(customRead.callbackValue, { _id: '1', name: 'custom-id' });
    const customUpdateModel = new CustomIdModel({ _id: '1', name: 'custom-updated' });
    assert.deepStrictEqual(observeDispatch(customSync, 'update', customUpdateModel).callbackValue, { _id: '1', name: 'custom-updated' });
    assert.strictEqual(observeDispatch(customSync, 'delete', customUpdateModel).callbackValue, undefined);
    assert.deepStrictEqual(CustomIdModel.store, []);
    const customMissingDelete = observeDispatch(customSync, 'delete', new CustomIdModel({ _id: 'missing' }));
    assert.ok(customMissingDelete.callbackValue instanceof Error);
    assert.strictEqual(customMissingDelete.callbackValue.message, 'Model not found. Type: MemorySyncCustomIdModel. Id: missing');
  });

  it('uses the configured id attribute for raw deletion when id payloads collide', () => {
    const CustomIdModel = createModelType('MemorySyncCustomIdCollisionModel', { id: 'String' }, '_id');
    const sync = BackboneORM.sync(CustomIdModel);
    const memorySync = dispatch(sync, 'sync') as DirectMemorySync;
    const target = { _id: '1', id: '2', label: 'target' };
    const survivor = { _id: '2', id: '1', label: 'survivor' };
    const survivorSnapshot = { ...survivor };

    memorySync.store.length = 0;
    memorySync.store.push(target, survivor);
    let rawDeleteError: Error | null | undefined;
    let rawDeleteCallbackCount = 0;
    memorySync.deleteCB(target, (error) => {
      rawDeleteCallbackCount += 1;
      rawDeleteError = error;
    });
    assert.ifError(rawDeleteError);
    assert.strictEqual(rawDeleteCallbackCount, 1);
    assert.deepStrictEqual(memorySync.store, [survivorSnapshot]);
    assert.notStrictEqual(memorySync.store[0], survivorSnapshot);
    assert.notStrictEqual(memorySync.store[0], target);

    memorySync.store.length = 0;
    memorySync.store.push(target, survivor);
    let queriedDestroyError: Error | null | undefined;
    let queriedDestroyCallbackCount = 0;
    dispatch(sync, 'destroy', { _id: '1' }, (error: Error | null) => {
      queriedDestroyCallbackCount += 1;
      queriedDestroyError = error;
    });
    assert.ifError(queriedDestroyError);
    assert.strictEqual(queriedDestroyCallbackCount, 1);
    assert.deepStrictEqual(memorySync.store, [survivorSnapshot]);

    memorySync.store.length = 0;
    memorySync.store.push(target, survivor);
    let scalarDestroyError: Error | null | undefined;
    let scalarDestroyCallbackCount = 0;
    dispatch(sync, 'destroy', '1', (error: Error | null) => {
      scalarDestroyCallbackCount += 1;
      scalarDestroyError = error;
    });
    assert.ifError(scalarDestroyError);
    assert.strictEqual(scalarDestroyCallbackCount, 1);
    assert.deepStrictEqual(memorySync.store, [survivorSnapshot]);

    memorySync.store.length = 0;
    memorySync.store.push(target, survivor);
    let ordinaryPayloadError: Error | null | undefined;
    let ordinaryPayloadCallbackCount = 0;
    memorySync.deleteCB({ id: '2', _id: '1', label: 'ordinary-payload' }, (error) => {
      ordinaryPayloadCallbackCount += 1;
      ordinaryPayloadError = error;
    });
    assert.ifError(ordinaryPayloadError);
    assert.strictEqual(ordinaryPayloadCallbackCount, 1);
    assert.deepStrictEqual(memorySync.store, [survivorSnapshot]);
  });

  it('preserves reset and queried destroy completion at the batch boundary', async () => {
    const ResetModel = createModelType('MemorySyncResetModel', {});
    ResetModel.store = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ];
    const resetSync = BackboneORM.sync(ResetModel);
    let resetCallbackArguments: unknown[] | undefined;
    let resetCallbackCount = 0;
    const resetReturn = dispatch(resetSync, 'resetSchema', {}, function resetCallback(...callbackArguments: unknown[]) {
      resetCallbackArguments = callbackArguments;
      resetCallbackCount += 1;
      return 'reset-callback-return';
    });
    assert.strictEqual(resetCallbackCount, 1);
    assert.deepStrictEqual(resetCallbackArguments, [null]);
    assert.strictEqual(resetReturn, 'reset-callback-return');
    assert.deepStrictEqual(ResetModel.store, []);

    const expectedArguments = new Map<number, unknown[]>([
      [1999, [null]],
      [2000, []],
      [2001, [null]],
    ]);
    for (const size of [1999, 2000, 2001]) {
      const BatchModel = createModelType(`MemorySyncBatchModel${size}`, { group: 'String' });
      BatchModel.store = Array.from({ length: size }, (_value, index) => ({
        group: 'remove',
        id: index + 1,
      }));
      const batchSync = BackboneORM.sync(BatchModel);
      let callbackArguments: unknown[] | undefined;
      let callbackCount = 0;
      await new Promise<void>((resolve, reject) => {
        const returned = dispatch(batchSync, 'destroy', { group: 'remove' }, function destroyCallback(...destroyArguments: unknown[]) {
          try {
            callbackArguments = destroyArguments;
            callbackCount += 1;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        assert.strictEqual(returned, undefined);
      });
      assert.strictEqual(callbackCount, 1);
      assert.deepStrictEqual(callbackArguments, expectedArguments.get(size));
      assert.deepStrictEqual(BatchModel.store, []);
    }
  });

  it('preserves empty, scalar, object, and zero-match destroy behavior', () => {
    const cases = [
      { expectedIds: [2, 3], expectedArguments: [null], expectedReturn: undefined, name: 'Scalar', query: 1 },
      { expectedIds: [1, 2, 3], expectedArguments: [null], expectedReturn: undefined, name: 'ScalarZero', query: 0 },
      { expectedIds: ['1', '3'], expectedArguments: [null], expectedReturn: undefined, name: 'ScalarString', query: '2' },
      { expectedIds: [1], expectedArguments: [null], expectedReturn: undefined, name: 'Object', query: { group: 'remove' } },
      { expectedIds: [1, 2, 3], expectedArguments: [], expectedReturn: undefined, name: 'Zero', query: { group: 'absent' } },
    ];
    for (const testCase of cases) {
      const ModelType = createModelType(`MemorySyncDestroy${testCase.name}Model`, { group: 'String', id: 'String' }, testCase.name === 'ScalarString' ? '_id' : 'id');
      ModelType.store = [
        ...(testCase.name === 'ScalarZero' ? [{ group: 'zero', id: 0 }] : []),
        { group: 'first', ...(testCase.name === 'ScalarString' ? { _id: '1' } : { id: 1 }) },
        { group: 'remove', ...(testCase.name === 'ScalarString' ? { _id: '2' } : { id: 2 }) },
        { group: 'remove', ...(testCase.name === 'ScalarString' ? { _id: '3' } : { id: 3 }) },
      ];
      const sync = BackboneORM.sync(ModelType);
      let count = 0;
      let callbackArguments: unknown[] = [];
      const returned = dispatch(sync, 'destroy', testCase.query, (...arguments_: unknown[]) => {
        count += 1;
        callbackArguments = arguments_;
        return 'destroy-query-return';
      });
      assert.strictEqual(count, 1);
      assert.deepStrictEqual(callbackArguments, testCase.expectedArguments);
      assert.strictEqual(returned, testCase.expectedReturn, testCase.name);
      assert.deepStrictEqual(
        ModelType.store?.map((row) => row[ModelType.prototype.idAttribute]),
        testCase.expectedIds
      );
    }

    const EmptyModel = createModelType('MemorySyncDestroyEmptyModel', {});
    const emptySync = BackboneORM.sync(EmptyModel);
    let emptyCallbackArguments: unknown[] | undefined;
    const emptyReturn = dispatch(emptySync, 'destroy', (...arguments_: unknown[]) => {
      emptyCallbackArguments = arguments_;
      return 'empty-destroy-return';
    });
    assert.deepStrictEqual(emptyCallbackArguments, []);
    assert.strictEqual(emptyReturn, 'empty-destroy-return');
  });

  it('retains published cursor result shapes behind an unresolved public type', () => {
    const ModelType = createModelType('MemorySyncCursorShapeModel', { name: 'String' });
    ModelType.store = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ];
    const sync = BackboneORM.sync(ModelType);
    const memorySync = dispatch(sync, 'sync') as DirectMemorySync;
    const observe = (query: object): unknown => {
      let result: unknown;
      let error: Error | null = null;
      memorySync.cursor(query).toJSON((callbackError, callbackResult) => {
        error = callbackError;
        result = callbackResult;
      });
      assert.ifError(error);
      return result;
    };

    assert.deepStrictEqual(observe({}), [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
    ]);
    assert.deepStrictEqual(observe({ $one: true }), { id: 1, name: 'first' });
    assert.strictEqual(observe({ $count: true }), 2);
  });

  it('returns plain JSON cursor includes without populating the model cache', async () => {
    BackboneORM.configure({ model_cache: { enabled: true, max: 100 } });
    let Author: TestModelConstructor;
    let Book: TestModelConstructor;
    Author = Backbone.Model.extend({
      model_name: 'MemorySyncCursorIncludeAuthor',
      schema() {
        return { books: ['hasMany', Book] };
      },
    }) as TestModelConstructor;
    Book = Backbone.Model.extend({
      model_name: 'MemorySyncCursorIncludeBook',
      schema() {
        return { author: ['belongsTo', Author] };
      },
    }) as TestModelConstructor;
    Author.store = [{ id: 1, name: 'Ada' }];
    Book.store = [{ id: 2, title: 'Notes' }];
    const authorSync = BackboneORM.sync(Author);
    BackboneORM.sync(Book);
    const foreignKey = (Reflect.get(Author, 'relation') as ((key: string) => { foreign_key?: string } | undefined) | undefined)?.('books')?.foreign_key;
    assert.ok(foreignKey);
    (Book.store[0] as Record<string, unknown>)[foreignKey] = 1;
    const cacheSync = dispatch(authorSync, 'sync') as { cursor(query?: unknown): { toJSON(callback: (error: Error | null, value: unknown) => unknown): unknown } };
    let callbackCount = 0;
    let error: Error | null | undefined;
    let result: unknown;
    await new Promise<void>((resolve, reject) => {
      try {
        cacheSync.cursor({ $include: 'books' }).toJSON((callbackError, value) => {
          callbackCount += 1;
          error = callbackError;
          result = value;
          resolve();
        });
      } catch (callbackError) {
        reject(callbackError);
      }
    });
    assert.strictEqual(callbackCount, 1);
    assert.ifError(error);
    const rows = result as Array<Record<string, unknown>>;
    assert.strictEqual(rows.length, 1);
    const included = rows[0].books as Array<Record<string, unknown>>;
    assert.strictEqual(included.length, 1);
    assert.ok(!(included[0] instanceof Book));
    assert.deepStrictEqual(included[0], { id: 2, title: 'Notes', [foreignKey]: 1 });
    assert.strictEqual((Book.cache as CacheStore | undefined)?.get(included[0].id), undefined);
  });

  it('uses the real relation schema when raw deletion cleans reverse data', () => {
    let Author: TestModelConstructor;
    let Book: TestModelConstructor;
    Author = Backbone.Model.extend({
      model_name: 'MemorySyncDeleteRelationAuthor',
      schema() {
        return { books: ['hasMany', Book] };
      },
    }) as TestModelConstructor;
    Book = Backbone.Model.extend({
      model_name: 'MemorySyncDeleteRelationBook',
      schema() {
        return { author: ['belongsTo', Author] };
      },
    }) as TestModelConstructor;
    Author.prototype.sync = BackboneORM.sync(Author);
    Book.prototype.sync = BackboneORM.sync(Book);

    const book = new Book({ name: 'book' });
    save(book);
    const author = new Author({ name: 'author' });
    (author as TestModel & LegacyPersistenceModel).set('books', [book]);
    save(author);
    const foreignKey = Object.keys(Book.store?.[0] ?? {}).find((key) => key !== 'id' && key !== 'name');
    assert.ok(foreignKey);
    assert.strictEqual(Book.store?.[0][foreignKey], author.id);

    const deletion = observeDispatch(Author.prototype.sync, 'delete', author);
    assert.strictEqual(deletion.callbackValue, undefined);
    assert.strictEqual(Author.store?.length, 0);
    assert.strictEqual(Book.store?.[0][foreignKey], null);

    Author.store?.push({ name: 'missing-id' });
    let cleanupCallbackCount = 0;
    let cleanupError: Error | null | undefined;
    const cleanupReturn = dispatch(Author.prototype.sync, 'destroy', { name: 'missing-id' }, (error: Error | null) => {
      cleanupCallbackCount += 1;
      cleanupError = error;
      return 'relation-error-return';
    });
    assert.strictEqual(cleanupReturn, undefined);
    assert.strictEqual(cleanupCallbackCount, 1);
    assert.strictEqual(cleanupError?.message, 'Many.patchRemove: model has null id for: books');
    assert.strictEqual(Author.store?.length, 1);
  });

  it('retains cache dispatch and cached model identity', () => {
    BackboneORM.configure({ model_cache: { enabled: true, max: 100 } });
    const ModelType = createModelType('MemorySyncCacheModel', {});
    const sync = BackboneORM.sync(ModelType);
    const cacheDispatch = dispatch(sync, 'sync') as CacheDispatch;
    assert.ok(!(cacheDispatch instanceof BackboneORM.sync.Sync));
    const memorySync = dispatch(cacheDispatch.wrapped_sync_fn, 'sync');
    assert.ok(memorySync instanceof BackboneORM.sync.Sync);

    const model = new ModelType({ name: 'cached' });
    const observation = observeDispatch(sync, 'create', model);
    assert.deepStrictEqual(observation.callbackValue, { id: 1, name: 'cached' });
    assert.strictEqual(ModelType.cache?.get(model.id), model);
  });
  describe('public hasOne null-save persistence', () => {
    afterEach(() => BackboneORM.configure({ model_cache: { enabled: false } }));

    for (const cache of [false, true]) {
      it(`persists replacement-to-null before final notification, cache=${cache}`, async () => {
        BackboneORM.configure({ model_cache: { enabled: cache, max: 100 } });
        const Profile = createModelType(`MemoryNullSaveProfile${cache}`, { name: 'String', owner: () => ['belongsTo', Owner, { as: 'profile' }] });
        const Owner = createModelType(`MemoryNullSaveOwner${cache}`, { name: 'String', profile: () => ['hasOne', Profile, { as: 'owner' }] });
        const ownerSync = BackboneORM.sync(Owner);
        Owner.prototype.sync = ownerSync;
        const ownerSchema: unknown = dispatch(ownerSync, 'schema');
        assert.ok(typeof ownerSchema === 'object' && ownerSchema !== null);
        const reverseSchema: unknown = dispatch(Profile.prototype.sync, 'schema');
        assert.ok(typeof reverseSchema === 'object' && reverseSchema !== null);
        const reverseRelations: unknown = Reflect.get(reverseSchema, 'relations');
        assert.ok(typeof reverseRelations === 'object' && reverseRelations !== null);
        const reverse: unknown = Reflect.get(reverseRelations, 'owner');
        assert.ok(typeof reverse === 'object' && reverse !== null);
        const foreignKey: unknown = Reflect.get(reverse, 'foreign_key');
        assert.ok(typeof foreignKey === 'string');
        const first = new Profile({ name: 'first' });
        const replacement = new Profile({ name: 'replacement' });
        const survivor = new Profile({ name: 'survivor' });
        for (const profile of [first, replacement, survivor]) save(profile);
        const owner = new Owner({ name: 'owner', profile: first });
        const other = new Owner({ name: 'other', profile: survivor });
        save(owner);
        save(other);
        owner.set('profile', replacement);
        save(owner);
        assert.strictEqual(Profile.store?.find((row) => row.id === replacement.id)?.[foreignKey], owner.id);
        owner.set('profile', null);
        owner.set('name', 'nulled');
        save(owner);
        assert.strictEqual(Profile.store?.find((row) => row.id === replacement.id)?.[foreignKey], null);
        assert.strictEqual(Profile.store?.find((row) => row.id === first.id)?.[foreignKey], null);
        assert.strictEqual(Profile.store?.find((row) => row.id === survivor.id)?.[foreignKey], other.id);
        assert.strictEqual(Owner.store?.find((row) => row.id === owner.id)?.name, 'nulled');
        assert.strictEqual(Profile.store?.length, 3);
        if (cache) {
          assert.strictEqual(Owner.cache?.get(owner.id), owner);
          assert.strictEqual(Profile.cache?.get(replacement.id), replacement);
          assert.strictEqual(replacement.get('owner'), null);
        }
        const directOwner = dispatch(ownerSync, 'sync') as DirectMemorySync;
        let includeCalls = 0;
        const included: unknown = await new Promise((resolve, reject) => {
          directOwner.cursor({ id: owner.id, $one: true, $include: 'profile' }).toJSON((error, value) => {
            includeCalls += 1;
            if (error) reject(error);
            else resolve(value);
          });
        });
        assert.strictEqual(includeCalls, 1);
        assert.ok(typeof included === 'object' && included !== null);
        assert.strictEqual(Reflect.get(included, 'profile'), null);
        const fresh = new Owner({ id: owner.id });
        let fetchCalls = 0;
        Reflect.apply(fresh.fetch, fresh, [
          (error?: Error | null) => {
            fetchCalls += 1;
            assert.ifError(error);
          },
        ]);
        assert.strictEqual(fetchCalls, 1);
        let relationCalls = 0;
        const related: unknown = await new Promise((resolve, reject) => {
          Reflect.apply(fresh.get, fresh, [
            'profile',
            (error: Error | null, profile: unknown) => {
              relationCalls += 1;
              if (error) return reject(error);
              resolve(profile);
            },
          ]);
        });
        assert.strictEqual(relationCalls, 1);
        assert.strictEqual(related, null);
        const empty = new Owner({ name: 'empty', profile: null });
        save(empty);
        save(empty);
        assert.strictEqual(Profile.store?.length, 3);
        assert.strictEqual(Profile.store?.find((row) => row.id === survivor.id)?.[foreignKey], other.id);
      });
    }
  });
});
