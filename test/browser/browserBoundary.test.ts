import assert from 'assert';

import type { BackboneORMRuntime } from 'backbone-orm/browser';
import cursorDataPropertyAssertions from '../lib/cursorDataPropertyAssertions.ts';
import databaseURLAuthorityTests from '../lib/databaseURLAuthorityTests.ts';
import queriedDeletionCacheScenario from '../lib/queriedDeletionCacheScenario.ts';
import observeRelationOperations from '../lib/relationOperationsScenario.ts';

type Callable = (...arguments_: never[]) => unknown;

interface RelationConstructors {
  Many: Callable;
  One: Callable;
  Relation: Callable;
  Schema: Callable;
}

interface CacheConstructors {
  CacheCursor: Callable;
  CacheSync: Callable;
  MemoryStore: Callable;
  MemorySync: Callable;
}

interface BrowserUtils {
  (): void;
  new (): object;
  configureModelType: Callable;
  findOrGenerateModelName: Callable;
  [key: string]: unknown;
}

interface BrowserConnectionPool {
  [key: string]: unknown;
  del(key: string): unknown;
  destroy(key: string): unknown;
  dispose(key: string): Promise<void>;
  disposeAll: Callable;
  forEach(callback: Callable): unknown;
  get(key: string): unknown;
  reset(): unknown;
  set(key: string, value: unknown): unknown;
  setOwned<T>(key: string, value: T, disposer: (value: T, callback: (error?: Error | null) => void) => void): unknown;
}

interface RetainedSnapshot {
  BaseConvention: Callable;
  Backbone: object;
  ConnectionPool: BrowserConnectionPool;
  Cursor: Callable;
  DatabaseURL: Callable;
  DateUtils: Callable;
  Fabricator: Callable;
  JSONUtils: Callable;
  MemoryCursor: Callable;
  MemoryStore: Callable;
  MemorySync: Callable;
  Queue: Callable;
  Schema: Callable;
  TestUtils: Callable;
  Utils: BrowserUtils;
  configure: Callable;
  configureModelType: Callable;
  collectionMethods: Record<string, Callable>;
  findOrGenerateModelName: Callable;
  cacheConstructors: CacheConstructors;
  connectionPoolLegacyMethods: Record<string, Callable>;
  connectionPoolValue: object;
  modelCache: object;
  modelCacheConfigure: Callable;
  modelCacheConfigureSync: Callable;
  modelCachePrototype: object;
  namingConvention: Callable;
  relationConstructors: RelationConstructors;
  iterationMethods: Record<string, Callable>;
  runtime: Record<string, unknown>;
  scriptURLs: string[];
  sync: Callable;
}

type BrowserTestGlobal = typeof globalThis & {
  Backbone: object;
  BackboneORM: Record<string, unknown>;
  location: { origin: string };
  __captureRelationConstructors(runtime: unknown, prefix: string): RelationConstructors;
  __captureCacheConstructors(runtime: unknown, prefix: string): CacheConstructors;
  __observeOwnedFind(runtime: unknown, prefix: string): Promise<{ configuredIdentity: boolean; findIsOwn: boolean; modelCount: number }>;
  __retainedOrmSnapshot: RetainedSnapshot;
};

function ownedIdentities(runtime: Record<string, unknown>): unknown[] {
  const sync = runtime.sync as { Cursor: Callable; Sync: Callable };
  const Utils = runtime.Utils as BrowserUtils & Record<string, Callable>;
  const modelCache = runtime.model_cache as { configure: Callable; configureSync: Callable };
  const pool = runtime.ConnectionPool as BrowserConnectionPool;
  return [
    runtime.BaseConvention,
    runtime.DatabaseURL,
    runtime.configure,
    runtime.JSONUtils,
    runtime.Schema,
    runtime.MemoryStore,
    runtime.Cursor,
    runtime.DateUtils,
    runtime.Queue,
    runtime.Fabricator,
    runtime.TestUtils,
    sync,
    sync.Cursor,
    sync.Sync,
    Utils,
    Utils.configureModelType,
    Utils.findOrGenerateModelName,
    Utils.each,
    Utils.eachC,
    Utils.eachDone,
    Utils.eachDoneC,
    Utils.popEach,
    Utils.popEachC,
    modelCache,
    Object.getPrototypeOf(modelCache),
    modelCache.configure,
    modelCache.configureSync,
    pool,
    pool.setOwned,
    pool.dispose,
    pool.disposeAll,
    pool.set,
    pool.get,
    pool.destroy,
    pool.del,
    pool.reset,
    pool.forEach,
    runtime.configureModel,
  ];
}

describe('explicit browser boundary', () => {
  describe('Cursor own query data with the actual browser provider', () => {
    let runtime: BackboneORMRuntime;
    before(async () => {
      runtime = (await import('backbone-orm/browser')).default;
    });
    cursorDataPropertyAssertions(() => runtime, 'BrowserCursorDataProperty');
  });
  describe('DatabaseURL with the actual adopted browser provider', () => {
    let runtime: BackboneORMRuntime;
    before(async () => {
      runtime = (await import('backbone-orm/browser')).default;
    });
    databaseURLAuthorityTests(() => runtime);
  });

  it('loads local retained scripts and installs every owned family on one runtime', async () => {
    const browserGlobal = globalThis as BrowserTestGlobal;
    const retained = browserGlobal.__retainedOrmSnapshot;
    const browserEntry = await import('backbone-orm/browser');
    const runtime = browserEntry.default as unknown as Record<string, unknown>;
    const sync = runtime.sync as { Cursor: Callable; Sync: Callable };
    const Utils = runtime.Utils as BrowserUtils & Record<string, Callable>;
    const modelCache = runtime.model_cache as { configure: Callable; configureSync: Callable };
    const pool = runtime.ConnectionPool as BrowserConnectionPool;

    assert.strictEqual(runtime, retained.runtime);
    assert.strictEqual(runtime, browserGlobal.BackboneORM);
    assert.strictEqual(runtime.Backbone, browserGlobal.Backbone);
    assert.strictEqual(runtime.Backbone, retained.Backbone);
    assert.strictEqual(Utils, retained.Utils);
    assert.strictEqual(Utils(), undefined);
    const utilsInstance = new Utils();
    assert.deepStrictEqual(Object.keys(utilsInstance), []);
    assert.strictEqual(utilsInstance.constructor, Utils);
    assert.ok(utilsInstance instanceof Utils);
    assert.strictEqual(modelCache, retained.modelCache);
    assert.strictEqual(pool, retained.ConnectionPool);
    assert.strictEqual(pool.get('retained-browser-connection'), retained.connectionPoolValue);
    for (const [key, method] of Object.entries(retained.connectionPoolLegacyMethods)) assert.notStrictEqual(pool[key], method);
    const memoryStorePrototype = (runtime.MemoryStore as { prototype: Record<string, Callable> }).prototype;
    assert.strictEqual(pool.del, memoryStorePrototype.del);
    for (const key of ['set', 'get', 'destroy', 'reset', 'forEach']) assert.notStrictEqual(pool[key], memoryStorePrototype[key]);
    assert.strictEqual(Object.getPrototypeOf(pool).del, Object.getPrototypeOf(pool).destroy);
    assert.strictEqual(typeof pool.setOwned, 'function');
    assert.strictEqual(typeof pool.dispose, 'function');
    assert.strictEqual(typeof pool.disposeAll, 'function');
    assert.notStrictEqual(runtime.Schema, retained.Schema);
    assert.notStrictEqual(runtime.BaseConvention, retained.BaseConvention);
    assert.notStrictEqual(runtime.DatabaseURL, retained.DatabaseURL);
    assert.notStrictEqual(runtime.configure, retained.configure);
    assert.notStrictEqual(runtime.JSONUtils, retained.JSONUtils);
    assert.notStrictEqual(runtime.MemoryStore, retained.MemoryStore);
    assert.notStrictEqual(runtime.Cursor, retained.Cursor);
    assert.notStrictEqual(runtime.DateUtils, retained.DateUtils);
    assert.notStrictEqual(runtime.Queue, retained.Queue);
    assert.notStrictEqual(runtime.Fabricator, retained.Fabricator);
    assert.notStrictEqual(runtime.TestUtils, retained.TestUtils);
    assert.notStrictEqual(sync, retained.sync);
    assert.notStrictEqual(sync.Cursor, retained.MemoryCursor);
    assert.notStrictEqual(sync.Sync, retained.MemorySync);
    assert.notStrictEqual(Utils.configureModelType, retained.configureModelType);
    assert.notStrictEqual(Utils.findOrGenerateModelName, retained.findOrGenerateModelName);
    assert.strictEqual(runtime.naming_conventions, retained.namingConvention);
    const collectionPrototype = (runtime.Backbone as { Collection: { prototype: Record<string, Callable> } }).Collection.prototype;
    assert.strictEqual(collectionPrototype.fetch, retained.collectionMethods.fetch);
    assert.strictEqual(collectionPrototype._prepareModel, retained.collectionMethods.prepareModel);
    assert.notStrictEqual(Object.getPrototypeOf(modelCache), retained.modelCachePrototype);
    assert.notStrictEqual(modelCache.configure, retained.modelCacheConfigure);
    assert.notStrictEqual(modelCache.configureSync, retained.modelCacheConfigureSync);
    for (const [key, method] of Object.entries(retained.iterationMethods)) assert.notStrictEqual((Utils as unknown as Record<string, Callable>)[key], method);

    assert.strictEqual((runtime.DateUtils as { durationAsMilliseconds(count: number, units: string): number }).durationAsMilliseconds(2, 'hours'), 2_880_000);
    const queueEvents: string[] = [];
    const Queue = runtime.Queue as new (
      parallelism?: number
    ) => {
      await(callback: (error?: Error | null) => unknown): unknown;
      defer(callback: (done: (error?: Error | null) => unknown) => unknown): unknown;
    };
    const queue = new Queue(1);
    queue.defer((done) => {
      queueEvents.push('task');
      return done();
    });
    assert.strictEqual(
      queue.await((error) => queueEvents.push(error ? 'error' : 'await')),
      2
    );
    assert.deepStrictEqual(queueEvents, ['task', 'await']);

    const Fabricator = runtime.Fabricator as {
      increment(value: number): () => number;
      uniqueId(prefix: string): () => string;
      uniqueString(prefix: string): () => string;
      value<T>(value: T): () => T;
    };
    assert.strictEqual(Fabricator.uniqueString, Fabricator.uniqueId);
    const increment = Fabricator.increment(3);
    assert.deepStrictEqual([increment(), increment(), increment()], [3, 4, 5]);
    const browserValue = {};
    assert.strictEqual(Fabricator.value(browserValue)(), browserValue);
    assert.ok(Fabricator.uniqueId('browser_')().startsWith('browser_'));

    const TestUtils = runtime.TestUtils as { optionSets(): Array<Record<string, unknown>> };
    const firstOptionSets = TestUtils.optionSets();
    const secondOptionSets = TestUtils.optionSets();
    assert.notStrictEqual(firstOptionSets, secondOptionSets);
    assert.ok(firstOptionSets.every((value, index) => value !== secondOptionSets[index]));

    let iterationCount = 0;
    await new Promise<void>((resolve, reject) => {
      (Utils as unknown as { each<T>(values: T[], iterator: (value: T, next: (error?: Error | null) => unknown) => unknown, callback: (error?: Error | null) => unknown): unknown }).each(
        Array.from({ length: 1001 }, (_value, index) => index),
        (_value, next) => {
          iterationCount += 1;
          return next();
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
    assert.strictEqual(iterationCount, 1001);

    const DatabaseURL = runtime.DatabaseURL as new (
      value: string
    ) => {
      format(options?: { exclude_query?: boolean; exclude_table?: boolean }): string;
      modelName(): string | null;
    };
    const databaseURL = new DatabaseURL('protocol://host1:81,host2:82/database/model_names?query=true');
    assert.strictEqual(databaseURL.format(), 'protocol://host1:81,host2:82/database/model_names?query=true');
    assert.strictEqual(databaseURL.format({ exclude_table: true }), 'protocol://host1:81,host2:82/database?query=true');
    assert.strictEqual(databaseURL.format({ exclude_query: true }), 'protocol://host1:81,host2:82/database/model_names');
    assert.strictEqual(databaseURL.modelName(), 'ModelName');

    const JSONUtils = runtime.JSONUtils as {
      parseQuery(value: Record<string, unknown>): Record<string, unknown>;
      querify(value: Record<string, unknown>): Record<string, string | undefined>;
    };
    assert.deepStrictEqual(JSONUtils.parseQuery(JSONUtils.querify({ at: new Date('2020-01-02T03:04:05.000Z'), count: 2 })), {
      at: new Date('2020-01-02T03:04:05.000Z'),
      count: 2,
    });

    (runtime.configure as (options: object) => unknown)({ naming_conventions: 'camelize' });
    assert.notStrictEqual(runtime.naming_conventions, retained.namingConvention);
    assert.strictEqual(databaseURL.modelName(), 'ModelName');
    (runtime.configure as (options: object) => unknown)({ naming_conventions: 'default' });

    const ownedCache = browserGlobal.__captureCacheConstructors(runtime, 'OwnedBrowserBoundary');
    assert.strictEqual(ownedCache.MemoryStore, runtime.MemoryStore);
    assert.strictEqual(ownedCache.MemorySync, sync.Sync);
    assert.notStrictEqual(ownedCache.CacheCursor, retained.cacheConstructors.CacheCursor);
    assert.notStrictEqual(ownedCache.CacheSync, retained.cacheConstructors.CacheSync);
    assert.notStrictEqual(ownedCache.MemoryStore, retained.cacheConstructors.MemoryStore);
    assert.notStrictEqual(ownedCache.MemorySync, retained.cacheConstructors.MemorySync);

    const ownedRelations = browserGlobal.__captureRelationConstructors(runtime, 'OwnedBrowserBoundary');
    assert.strictEqual(ownedRelations.Schema, runtime.Schema);
    assert.notStrictEqual(ownedRelations.Schema, retained.relationConstructors.Schema);
    assert.notStrictEqual(ownedRelations.Relation, retained.relationConstructors.Relation);
    assert.notStrictEqual(ownedRelations.One, retained.relationConstructors.One);
    assert.notStrictEqual(ownedRelations.Many, retained.relationConstructors.Many);

    assert.deepStrictEqual(
      retained.scriptURLs.map((url) => new URL(url).origin),
      [browserGlobal.location.origin, browserGlobal.location.origin, browserGlobal.location.origin]
    );
    const scriptPaths = retained.scriptURLs.map((url) => new URL(url).pathname);
    assert.match(scriptPaths[0], /underscore-umd\.js$/);
    assert.match(scriptPaths[1], /backbone\.js$/);
    assert.match(scriptPaths[2], /backbone-orm\.js$/);

    assert.deepStrictEqual(await browserGlobal.__observeOwnedFind(runtime, 'OwnedBrowserBoundary'), {
      configuredIdentity: true,
      findIsOwn: true,
      modelCount: 0,
    });

    const ownedConnection = { id: 'owned-browser-connection' };
    let disposerCalls = 0;
    pool.setOwned('owned-browser-connection', ownedConnection, (value: unknown, callback: (error?: Error | null) => void) => {
      assert.strictEqual(value, ownedConnection);
      disposerCalls += 1;
      callback(null);
    });
    await pool.dispose('owned-browser-connection');
    assert.strictEqual(disposerCalls, 1);
    assert.strictEqual(pool.get('owned-browser-connection'), undefined);
  });

  it('is idempotent and rejects missing or mismatched globals before mutation', async () => {
    const browserGlobal = globalThis as BrowserTestGlobal;
    const browserEntry = await import('backbone-orm/browser');
    const runtime = browserEntry.default as unknown as Record<string, unknown>;
    const before = ownedIdentities(runtime);

    assert.strictEqual(browserEntry.installBrowserRuntime(browserGlobal), runtime);
    assert.strictEqual(browserEntry.installBrowserRuntime(browserGlobal), runtime);
    assert.deepStrictEqual(ownedIdentities(runtime), before);

    assert.throws(() => browserEntry.installBrowserRuntime({ Backbone: browserGlobal.Backbone }), /browser runtime is missing/);
    assert.deepStrictEqual(ownedIdentities(runtime), before);
    assert.throws(() => browserEntry.installBrowserRuntime({ BackboneORM: runtime }), /Backbone browser runtime is missing/);
    assert.deepStrictEqual(ownedIdentities(runtime), before);
    assert.throws(() => browserEntry.installBrowserRuntime({ Backbone: {}, BackboneORM: runtime }), /same Backbone instance/);
    assert.deepStrictEqual(ownedIdentities(runtime), before);

    const invalidRuntime = Object.create(runtime) as Record<string, unknown>;
    invalidRuntime.Utils = undefined;
    assert.throws(() => browserEntry.installBrowserRuntime({ Backbone: browserGlobal.Backbone, BackboneORM: invalidRuntime }), /missing Utils/);
    assert.deepStrictEqual(ownedIdentities(runtime), before);
  });

  it('runs owned memory relations in the real browser', async () => {
    const browserGlobal = globalThis as BrowserTestGlobal;
    const browserEntry = await import('backbone-orm/browser');
    const observations = await observeRelationOperations(browserEntry.default, browserGlobal.Backbone);

    assert.deepStrictEqual(observations.cursor, {
      count: 3,
      idValues: [1, 2, 3],
      page: [{ id: 2, rank: 2 }],
    });
    assert.deepStrictEqual(observations.collectionLifecycle, {
      afterAdd: [true, true],
      afterManyRelease: { collectionLength: 1, parentOrmMissing: true },
      afterOneRelease: {
        oldBacklinkRetained: true,
        ormMissing: false,
        profileAfterRelease: 2,
        replacementBacklinkInstalled: false,
      },
      afterRemove: [null, true],
      afterReset: [true, null, [1]],
    });
  });

  it('materializes zero-ID object queries through owned browser Utils without changing independent owners', async () => {
    const { default: runtime } = await import('backbone-orm/browser');
    try {
      for (const cache of [false, true]) {
        runtime.configure({ model_cache: { enabled: cache, max: 100 } });
        class ZeroModel extends runtime.Backbone.Model {
          static model_name = `BrowserZeroID${cache}`;
          static store: Record<string, unknown>[] = [];
          urlRoot = 'memory://browser-zero-id/items';
          schema() {
            return { id: ['Integer', { manual: true }] };
          }
        }
        const Type = runtime.configureModel(ZeroModel);
        const zero = new Type({ id: 0, name: 'zero', _rev: 1 });
        const survivor = new Type({ id: 1, name: 'survivor', _rev: 1 });
        for (const model of [zero, survivor]) {
          let calls = 0;
          model.save(null, {
            success: () => {
              calls++;
            },
            error: (_model, error: Error) => {
              throw error;
            },
          });
          assert.strictEqual(calls, 1);
        }
        const first = (await Type.find({ id: 0 }))[0];
        const second = (await Type.find({ id: 0 }))[0];
        if (cache) {
          assert.strictEqual(first, zero);
          assert.strictEqual(second, zero);
        } else {
          assert.notStrictEqual(first, zero);
          assert.notStrictEqual(second, first);
        }
        const stored = Type.store.find((row) => row.id === 0);
        assert.ok(stored);
        stored.name = 'updated';
        stored._rev = 2;
        const updated = (await Type.find({ id: 0 }))[0];
        assert.deepStrictEqual(updated.toJSON(), { id: 0, name: 'updated', _rev: 2 });
        const surviving = (await Type.find({ id: 1 }))[0];
        assert.deepStrictEqual(surviving.toJSON(), { id: 1, name: 'survivor', _rev: 1 });
        if (cache) {
          assert.strictEqual(updated, zero);
          assert.strictEqual(surviving, survivor);
        } else assert.notStrictEqual(surviving, survivor);
        const missingID = runtime.Utils.updateOrNew({ name: 'without-id' }, Type);
        assert.ok(missingID);
        assert.notStrictEqual(missingID, zero);
        assert.strictEqual(missingID.id, undefined);
      }
    } finally {
      runtime.configure({ model_cache: { enabled: false } });
    }
  });

  it('retains a target row/cache on original relation cleanup failure in the browser', async () => {
    const { default: runtime } = await import('backbone-orm/browser');
    runtime.configure({ model_cache: { enabled: true, max: 100 } });
    const Backbone = runtime.Backbone;
    class Parent extends Backbone.Model {
      get model_name() {
        return 'BrowserDeletionIntegrityParent';
      }
      schema() {
        return { children: () => ['hasMany', Child, { as: 'parent' }] };
      }
    }
    class Child extends Backbone.Model {
      get model_name() {
        return 'BrowserDeletionIntegrityChild';
      }
      schema() {
        return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
      }
    }
    runtime.configureModel(Parent);
    runtime.configureModel(Child);
    const save = (model: Backbone.Model): void => {
      let count = 0;
      Reflect.apply(model.save, model, [
        (error: Error) => {
          assert.ifError(error);
          count++;
        },
      ]);
      assert.strictEqual(count, 1);
    };
    const parent = new Parent();
    save(parent);
    const book = new Child({ parent });
    save(book);
    let successful = 0;
    Reflect.apply(book.destroy, book, [
      (error: Error) => {
        assert.ifError(error);
        successful++;
      },
    ]);
    assert.strictEqual(successful, 1);
    assert.deepStrictEqual(Reflect.get(Child, 'store'), []);
    save(new Child({ parent }));
    const rows = Reflect.get(Parent, 'store') as Array<Record<string, unknown>>;
    const captured = rows[0];
    const failure = new Error('browser-relation-callback-input');
    const original = Child.prototype.sync;
    Reflect.set(Child.prototype, 'sync', function rejectUpdate(this: unknown, method: string, model: Backbone.Model, options: { error(error: Error): unknown }): unknown {
      if (method === 'update') return options.error(failure);
      return Reflect.apply(original, this, [method, model, options]);
    });
    let count = 0;
    Reflect.apply(parent.destroy, parent, [
      (error: Error) => {
        assert.strictEqual(error, failure);
        count++;
      },
    ]);
    assert.strictEqual(count, 1);
    assert.strictEqual(rows[0], captured);
    const cache = Reflect.get(Parent, 'cache') as { get(id: unknown): unknown };
    assert.strictEqual(cache.get(parent.id), parent);
    runtime.configure({ model_cache: { enabled: false } });
  });

  it('rejects a live browser sync.store replacement without deleting unrelated rows', async () => {
    const { default: runtime } = await import('backbone-orm/browser');
    runtime.configure({ model_cache: { enabled: true, max: 100 } });
    let Child: typeof runtime.Backbone.Model;
    const Parent = runtime.Backbone.Model.extend({
      model_name: 'BrowserReboundDeletionParent',
      schema() {
        return { id: ['Integer', { manual: true }], children: () => ['hasMany', Child, { as: 'parent' }] };
      },
    });
    Child = runtime.Backbone.Model.extend({
      model_name: 'BrowserReboundDeletionChild',
      schema() {
        return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
      },
    });
    runtime.configureModel(Parent);
    runtime.configureModel(Child);
    const save = (model: Backbone.Model): void => {
      let count = 0;
      Reflect.apply(model.save, model, [
        (error: Error) => {
          assert.ifError(error);
          count++;
        },
      ]);
      assert.strictEqual(count, 1);
    };
    const parent = new Parent({ id: 1 });
    save(parent);
    save(new Child({ parent }));
    const wrapper = Reflect.apply(Parent.prototype.sync, undefined, ['sync']) as { wrapped_sync_fn(method: string): unknown };
    const worker = wrapper.wrapped_sync_fn('sync') as { store: Array<Record<string, unknown>> };
    const capturedStore = worker.store;
    const captured = capturedStore[0];
    const original = Child.prototype.sync;
    let resume: (() => unknown) | undefined;
    Reflect.set(Child.prototype, 'sync', function suspended(this: unknown, method: string, model: Backbone.Model, options: object): unknown {
      if (method === 'update') {
        resume = () => Reflect.apply(original, this, [method, model, options]);
        return;
      }
      return Reflect.apply(original, this, [method, model, options]);
    });
    try {
      let callbackCount = 0;
      let failure: Error | null | undefined;
      Reflect.apply(parent.destroy, parent, [
        (error: Error) => {
          callbackCount++;
          failure = error;
        },
      ]);
      assert.ok(resume);
      const replacementStore = [{ id: 9 }, { id: 10 }];
      worker.store = replacementStore;
      resume();
      assert.strictEqual(callbackCount, 1);
      assert.match(failure?.message ?? '', /Deletion conflict/);
      assert.deepStrictEqual(replacementStore, [{ id: 9 }, { id: 10 }]);
      assert.deepStrictEqual(capturedStore, [captured]);
      assert.strictEqual(Reflect.get(Parent, 'store'), capturedStore);
      const cache = Reflect.get(Parent, 'cache') as { get(id: unknown): unknown };
      assert.strictEqual(cache.get(1), parent);
    } finally {
      Child.prototype.sync = original;
      runtime.configure({ model_cache: { enabled: false } });
    }
  });

  it('rejects an overridden browser relation cleanup before target or reverse mutation', async () => {
    const { default: runtime } = await import('backbone-orm/browser');
    runtime.configure({ model_cache: { enabled: true, max: 100 } });
    let Child: typeof runtime.Backbone.Model;
    const Parent = runtime.Backbone.Model.extend({
      model_name: 'BrowserOverrideDeletionParent',
      schema() {
        return { children: () => ['hasMany', Child, { as: 'parent' }] };
      },
    });
    Child = runtime.Backbone.Model.extend({
      model_name: 'BrowserOverrideDeletionChild',
      schema() {
        return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
      },
    });
    runtime.configureModel(Parent);
    runtime.configureModel(Child);
    const save = (model: Backbone.Model): void => {
      let count = 0;
      Reflect.apply(model.save, model, [
        (error: Error) => {
          assert.ifError(error);
          count++;
        },
      ]);
      assert.strictEqual(count, 1);
    };
    const parent = new Parent();
    save(parent);
    const child = new Child({ parent });
    save(child);
    const schema = Reflect.apply(Reflect.get(Parent, 'schema'), Parent, []) as { relations: Record<string, object> };
    const relation = schema.relations.children;
    const original = Reflect.get(relation, 'patchRemove') as (...arguments_: unknown[]) => unknown;
    let overrideCalls = 0;
    Reflect.set(relation, 'patchRemove', function overridden(this: unknown, ...arguments_: unknown[]): unknown {
      overrideCalls++;
      return Reflect.apply(original, this, arguments_);
    });
    const capturedRows = (Reflect.get(Parent, 'store') as Array<Record<string, unknown>>).slice();
    const capturedChildren = (Reflect.get(Child, 'store') as Array<Record<string, unknown>>).slice();
    let callbackCount = 0;
    Reflect.apply(parent.destroy, parent, [
      (error: Error) => {
        assert.match(error?.message ?? '', /Unsupported relation\.patchRemove override/);
        callbackCount++;
      },
    ]);
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(overrideCalls, 0);
    assert.deepStrictEqual(Reflect.get(Parent, 'store'), capturedRows);
    assert.deepStrictEqual(Reflect.get(Child, 'store'), capturedChildren);
    assert.strictEqual(child.get('parent'), parent);
    const cache = Reflect.get(Parent, 'cache') as { get(id: unknown): unknown };
    assert.strictEqual(cache.get(parent.id), parent);
    runtime.configure({ model_cache: { enabled: false } });
  });

  for (const replaceCache of [false, true]) {
    it(`captures later queried-batch browser cache owners, replacement=${replaceCache}`, async () => {
      const { default: runtime } = await import('backbone-orm/browser');
      await queriedDeletionCacheScenario(runtime, replaceCache);
    });
  }

  describe('fresh owned implementation admission with the retained browser scripts', () => {
    it('supplies omitted implementations while preserving adopted state and validation', async () => {
      const browserGlobal = globalThis as BrowserTestGlobal;
      const browserEntry = await import('backbone-orm/browser');
      const parentRuntime = browserEntry.default as unknown as Record<string, unknown>;
      const parentIdentities = ownedIdentities(parentRuntime);
      const frame = document.createElement('iframe');
      frame.hidden = true;
      let failed = false;
      let failure: unknown;
      try {
        document.body.append(frame);
        const child = frame.contentWindow;
        const documentInFrame = frame.contentDocument;
        assert.ok(child);
        assert.ok(documentInFrame);
        const scriptURLs = browserGlobal.__retainedOrmSnapshot.scriptURLs;
        assert.strictEqual(scriptURLs.length, 3);
        for (const url of scriptURLs) {
          assert.strictEqual(new URL(url).origin, browserGlobal.location.origin);
          await new Promise<void>((resolve, reject) => {
            const script = documentInFrame.createElement('script');
            const clear = (): void => {
              script.onload = null;
              script.onerror = null;
            };
            script.onload = () => {
              clear();
              resolve();
            };
            script.onerror = () => {
              clear();
              reject(new Error(`Unable to load retained browser script ${url}`));
            };
            script.src = url;
            documentInFrame.body.append(script);
          });
        }

        const childGlobal = child as unknown as BrowserTestGlobal;
        const rawRuntime = childGlobal.BackboneORM;
        const legacy = rawRuntime as unknown as BackboneORMRuntime;
        const marker = { id: 'fresh-fabrication-adoption' };
        const naming = legacy.naming_conventions;
        legacy.configure({ model_cache: { enabled: true, max: 19 }, adoption_marker: marker });
        const preconfigured = legacy.Backbone.Model.extend({
          model_name: 'FreshBrowserPreconfigured',
          schema() {
            return { name: 'String' };
          },
        });
        preconfigured.prototype.sync = legacy.sync(preconfigured);
        const priorSync = preconfigured.prototype.sync;
        const cachedModel = new preconfigured({ id: 'seed', name: 'retained' });
        const cache = Reflect.get(preconfigured, 'cache') as { get(key: string): unknown; set(key: string, value: object): unknown };
        assert.strictEqual(typeof cache?.set, 'function');
        cache.set('seed', cachedModel);
        const modelCache = legacy.model_cache;
        const options = Reflect.get(modelCache, 'options');
        const caches = Reflect.get(modelCache, 'caches');
        const pool = legacy.ConnectionPool;
        pool.set('fresh-fabrication-connection', marker);
        const utils = legacy.Utils;
        const underscore = legacy._;
        const modules = rawRuntime.modules;
        const collectionOriginals = Reflect.get(legacy.Backbone.Collection.prototype, '_orm_original_fns');
        assert.ok(collectionOriginals);

        assert.strictEqual(Reflect.deleteProperty(rawRuntime, 'Fabricator'), true);
        assert.strictEqual(Reflect.deleteProperty(rawRuntime, 'TestUtils'), true);
        assert.strictEqual('Fabricator' in rawRuntime, false);
        assert.strictEqual('TestUtils' in rawRuntime, false);
        for (const key of ['Queue', 'DateUtils', 'JSONUtils']) {
          assert.strictEqual(Reflect.deleteProperty(rawRuntime, key), true);
          assert.strictEqual(Reflect.has(rawRuntime, key), false);
        }
        for (const key of ['DatabaseURL', 'configure', 'Schema', 'MemoryStore', 'sync']) {
          assert.strictEqual(Reflect.deleteProperty(rawRuntime, key), true);
          assert.strictEqual(Reflect.has(rawRuntime, key), false);
        }
        assert.strictEqual(Reflect.deleteProperty(utils, 'configureModelType'), true);
        assert.strictEqual(Reflect.has(utils, 'configureModelType'), false);
        assert.strictEqual(Reflect.has(rawRuntime, Symbol.for('backbone-orm.runtime.owned-state')), false);
        for (const key of ['Utils', '_']) {
          const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, key);
          assert.ok(descriptor);
          try {
            Reflect.set(rawRuntime, key, undefined);
            const before = Object.getOwnPropertyDescriptors(rawRuntime);
            assert.throws(() => browserEntry.installBrowserRuntime(childGlobal), new RegExp(`missing ${key}`));
            assert.deepStrictEqual(Object.getOwnPropertyDescriptors(rawRuntime), before);
          } finally {
            Object.defineProperty(rawRuntime, key, descriptor);
          }
        }

        const runtime = browserEntry.installBrowserRuntime(childGlobal);
        assert.strictEqual(runtime, rawRuntime);
        assert.strictEqual(runtime, childGlobal.BackboneORM);
        assert.strictEqual(runtime.Backbone, childGlobal.Backbone);
        assert.notStrictEqual(runtime.Backbone, browserGlobal.Backbone);
        assert.strictEqual(runtime.Utils, utils);
        assert.strictEqual(runtime._, underscore);
        assert.strictEqual(runtime.modules, modules);
        assert.strictEqual(runtime.model_cache, modelCache);
        assert.strictEqual(Reflect.get(modelCache, 'options'), options);
        assert.strictEqual(Reflect.get(modelCache, 'caches'), caches);
        assert.strictEqual(Reflect.get(modelCache, 'enabled'), true);
        assert.ok(options !== null && typeof options === 'object');
        assert.strictEqual(Reflect.get(options, 'max'), 19);
        assert.strictEqual(runtime.ConnectionPool, pool);
        assert.strictEqual(pool.get('fresh-fabrication-connection'), marker);
        assert.strictEqual(runtime.adoption_marker, marker);
        assert.strictEqual(runtime.naming_conventions, naming);
        assert.strictEqual(Reflect.get(runtime.Backbone.Collection.prototype, '_orm_original_fns'), collectionOriginals);
        assert.strictEqual(preconfigured.prototype.sync, priorSync);
        assert.strictEqual(Reflect.get(preconfigured, 'cache'), cache);
        assert.strictEqual(cache.get('seed'), cachedModel);
        assert.strictEqual(cachedModel.get('name'), 'retained');

        const jsonUtils = runtime.JSONUtils;
        assert.strictEqual(typeof jsonUtils, 'function');
        assert.strictEqual(Reflect.get(rawRuntime, Symbol.for('backbone-orm.json-utils.owned-state')), jsonUtils);
        const jsonDate = new Date('2020-01-02T03:04:05.000Z');
        const query = jsonUtils.querify({ at: jsonDate, count: 2, enabled: false });
        assert.deepStrictEqual(query, { at: '"2020-01-02T03:04:05.000Z"', count: '2', enabled: 'false' });
        const parsedQuery = jsonUtils.parseQuery(query);
        assert.ok(parsedQuery.at instanceof Date);
        assert.strictEqual(parsedQuery.at.getTime(), jsonDate.getTime());
        assert.strictEqual(parsedQuery.count, 2);
        assert.strictEqual(parsedQuery.enabled, false);
        const jsonSource = { at: jsonDate, rows: [{ name: 'retained-json' }] };
        const jsonClone = jsonUtils.deepClone(jsonSource, 2);
        assert.notStrictEqual(jsonClone, jsonSource);
        assert.notStrictEqual(jsonClone.at, jsonSource.at);
        assert.strictEqual(jsonClone.at.getTime(), jsonSource.at.getTime());
        assert.notStrictEqual(jsonClone.rows, jsonSource.rows);
        assert.notStrictEqual(jsonClone.rows[0], jsonSource.rows[0]);
        jsonClone.rows[0].name = 'changed-clone';
        assert.strictEqual(jsonSource.rows[0].name, 'retained-json');
        assert.strictEqual(jsonUtils.stringify({ count: 2 }), '{"count":2}');
        assert.strictEqual(jsonUtils.isEmptyObject({}), true);
        assert.strictEqual(jsonUtils.isEmptyObject({ count: 2 }), false);

        const databaseURL = new runtime.DatabaseURL('memory://localhost/admission/fresh_browser_records');
        assert.strictEqual(databaseURL.database, 'admission');
        assert.strictEqual(databaseURL.table, 'fresh_browser_records');
        assert.strictEqual(databaseURL.modelName(), 'FreshBrowserRecord');
        assert.strictEqual(databaseURL.format(), 'memory://localhost/admission/fresh_browser_records');
        const configuredMarker = { id: 'owned-configure-admission' };
        assert.deepStrictEqual(runtime.configure({ owned_admission_marker: configuredMarker }), [configuredMarker]);
        assert.strictEqual(runtime.owned_admission_marker, configuredMarker);
        assert.strictEqual(runtime.naming_conventions, naming);

        const MemoryStore = runtime.MemoryStore as new (options: { max: number }) => {
          set(key: string, value: object): unknown;
          get(key: string): unknown;
          destroy(key: string): unknown;
        };
        const store = new MemoryStore({ max: 2 });
        assert.strictEqual(store.set('owned', configuredMarker), store);
        assert.strictEqual(store.get('owned'), configuredMarker);
        assert.strictEqual(store.destroy('owned'), store);
        assert.strictEqual(store.get('owned'), undefined);

        const FreshModel = runtime.Backbone.Model.extend({
          model_name: 'FreshBrowserOwnedImplementation',
          schema() {
            return { name: 'String' };
          },
        });
        const schema = new runtime.Schema(FreshModel);
        schema.initialize();
        assert.strictEqual(schema.type('name'), 'String');
        assert.deepStrictEqual(schema.columns(), ['name', 'id']);
        const configured = runtime.configureModel(FreshModel);
        assert.strictEqual(configured, FreshModel);
        const freshSync = configured.prototype.sync;
        assert.strictEqual(runtime.sync(configured), freshSync);
        assert.strictEqual(freshSync('isRemote'), false);
        assert.ok(freshSync('schema') instanceof runtime.Schema);
        const find = configured.find;
        runtime.Utils.configureModelType(configured);
        assert.strictEqual(configured.find, find);
        assert.strictEqual(configured.prototype.sync, freshSync);
        const saved = new configured({ name: 'owned-memory' });
        await new Promise<void>((resolve, reject) => {
          saved.save(null, {
            success: () => resolve(),
            error: (_model, error) => reject(error),
          });
        });
        assert.strictEqual(saved.id, 1);
        const found = await configured.find({ id: 1 });
        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0], saved);
        assert.strictEqual(found[0].get('name'), 'owned-memory');
        assert.strictEqual(preconfigured.prototype.sync, priorSync);
        assert.strictEqual(Reflect.get(preconfigured, 'cache'), cache);
        assert.strictEqual(cache.get('seed'), cachedModel);
        assert.strictEqual(runtime.model_cache, modelCache);
        assert.strictEqual(Reflect.get(modelCache, 'options'), options);
        assert.strictEqual(Reflect.get(modelCache, 'caches'), caches);
        assert.strictEqual(pool.get('fresh-fabrication-connection'), marker);

        assert.strictEqual(typeof runtime.Queue, 'function');
        assert.strictEqual(typeof runtime.DateUtils, 'function');
        const queue = new runtime.Queue(1);
        const queueEvents: string[] = [];
        assert.strictEqual(
          queue.defer((done) => {
            queueEvents.push('task');
            return done();
          }),
          undefined
        );
        assert.strictEqual(
          queue.await((error) => {
            assert.ifError(error);
            queueEvents.push('await');
            return 'completed';
          }),
          'completed'
        );
        assert.deepStrictEqual(queueEvents, ['task', 'await']);
        const dates = runtime.DateUtils;
        assert.ok(new dates() instanceof dates);
        assert.strictEqual(dates.durationAsMilliseconds(2, 'hours'), 2_880_000);
        assert.strictEqual(dates.isBefore(new Date(10), new Date(20)), true);
        assert.strictEqual(dates.isAfter(new Date(20), new Date(10)), true);
        assert.strictEqual(dates.isEqual(new Date(10), 10), true);
        assert.throws(() => dates.durationAsMilliseconds(1, 'fortnights'), /Unrecognized units/);

        assert.strictEqual(typeof runtime.Fabricator, 'function');
        assert.strictEqual(typeof runtime.TestUtils, 'function');
        const fabricated = runtime.Fabricator.new(runtime.Backbone.Model, 2, { rank: runtime.Fabricator.increment(7) });
        assert.deepStrictEqual(
          fabricated.map((model) => model.get('rank')),
          [7, 8]
        );
        assert.ok(fabricated.every((model) => model instanceof runtime.Backbone.Model));
        const first = runtime.TestUtils.optionSets();
        const second = runtime.TestUtils.optionSets();
        assert.deepStrictEqual(
          first.map((value) => [value.cache, value.embed]),
          [
            [false, false],
            [true, false],
            [false, true],
            [true, true],
          ]
        );
        assert.notStrictEqual(first, second);
        assert.ok(first.every((value, index) => value !== second[index]));

        const identities = ownedIdentities(rawRuntime);
        assert.strictEqual(browserEntry.installBrowserRuntime(childGlobal), runtime);
        assert.deepStrictEqual(ownedIdentities(rawRuntime), identities);
        for (const key of ['Fabricator', 'TestUtils', 'Queue', 'DateUtils', 'JSONUtils']) {
          const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, key);
          assert.ok(descriptor);
          try {
            assert.strictEqual(Reflect.deleteProperty(rawRuntime, key), true);
            const before = Object.getOwnPropertyDescriptors(rawRuntime);
            assert.throws(() => browserEntry.installBrowserRuntime(childGlobal), new RegExp(`missing ${key}`));
            assert.deepStrictEqual(Object.getOwnPropertyDescriptors(rawRuntime), before);
          } finally {
            Object.defineProperty(rawRuntime, key, descriptor);
          }
        }
        for (const key of ['DatabaseURL', 'configure', 'Schema', 'MemoryStore', 'sync']) {
          const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, key);
          assert.ok(descriptor);
          try {
            assert.strictEqual(Reflect.deleteProperty(rawRuntime, key), true);
            const before = Object.getOwnPropertyDescriptors(rawRuntime);
            assert.throws(() => browserEntry.installBrowserRuntime(childGlobal), new RegExp(`missing ${key}`));
            assert.deepStrictEqual(Object.getOwnPropertyDescriptors(rawRuntime), before);
          } finally {
            Object.defineProperty(rawRuntime, key, descriptor);
          }
        }
        const configureModelTypeDescriptor = Object.getOwnPropertyDescriptor(utils, 'configureModelType');
        assert.ok(configureModelTypeDescriptor);
        try {
          assert.strictEqual(Reflect.deleteProperty(utils, 'configureModelType'), true);
          const beforeRuntime = Object.getOwnPropertyDescriptors(rawRuntime);
          const beforeUtils = Object.getOwnPropertyDescriptors(utils);
          assert.throws(() => browserEntry.installBrowserRuntime(childGlobal), /missing configureModelType/);
          assert.deepStrictEqual(Object.getOwnPropertyDescriptors(rawRuntime), beforeRuntime);
          assert.deepStrictEqual(Object.getOwnPropertyDescriptors(utils), beforeUtils);
        } finally {
          Object.defineProperty(utils, 'configureModelType', configureModelTypeDescriptor);
        }
        for (const [key, value] of [
          ['Queue', {}],
          ['DateUtils', null],
          ['JSONUtils', null],
        ] as const) {
          const descriptor = Object.getOwnPropertyDescriptor(rawRuntime, key);
          assert.ok(descriptor);
          try {
            assert.strictEqual(Reflect.set(rawRuntime, key, value), true);
            const before = Object.getOwnPropertyDescriptors(rawRuntime);
            assert.throws(() => browserEntry.installBrowserRuntime(childGlobal), new RegExp(`missing ${key}`));
            assert.deepStrictEqual(Object.getOwnPropertyDescriptors(rawRuntime), before);
          } finally {
            Object.defineProperty(rawRuntime, key, descriptor);
          }
        }
        assert.deepStrictEqual(ownedIdentities(rawRuntime), identities);
        assert.strictEqual(runtime.JSONUtils, jsonUtils);
        assert.strictEqual(runtime.Backbone, childGlobal.Backbone);
        assert.strictEqual(childGlobal.BackboneORM, rawRuntime);
        assert.strictEqual(runtime.Utils, utils);
        assert.strictEqual(runtime._, underscore);
        assert.strictEqual(runtime.modules, modules);
        assert.strictEqual(runtime.model_cache, modelCache);
        assert.strictEqual(Reflect.get(modelCache, 'options'), options);
        assert.strictEqual(Reflect.get(modelCache, 'caches'), caches);
        assert.strictEqual(Reflect.get(modelCache, 'enabled'), true);
        assert.strictEqual(Reflect.get(options, 'max'), 19);
        assert.strictEqual(preconfigured.prototype.sync, priorSync);
        assert.strictEqual(Reflect.get(preconfigured, 'cache'), cache);
        assert.strictEqual(cache.get('seed'), cachedModel);
        assert.strictEqual(cachedModel.get('name'), 'retained');
        assert.strictEqual(runtime.ConnectionPool, pool);
        assert.strictEqual(pool.get('fresh-fabrication-connection'), marker);
        assert.strictEqual(runtime.naming_conventions, naming);
        assert.strictEqual(runtime.adoption_marker, marker);
        assert.strictEqual(Reflect.get(runtime.Backbone.Collection.prototype, '_orm_original_fns'), collectionOriginals);
      } catch (error) {
        failed = true;
        failure = error;
      }
      const cleanupFailures: unknown[] = [];
      for (const cleanup of [() => frame.remove(), () => assert.strictEqual(frame.isConnected, false), () => assert.deepStrictEqual(ownedIdentities(parentRuntime), parentIdentities)]) {
        try {
          cleanup();
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      if (failed) {
        if (cleanupFailures.length) throw new AggregateError([failure, ...cleanupFailures], 'Fresh browser adoption and cleanup failed');
        throw failure;
      }
      if (cleanupFailures.length) throw new AggregateError(cleanupFailures, 'Fresh browser adoption cleanup failed');
    });
  });
});
