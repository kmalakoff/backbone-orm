import assert from 'assert';
import Backbone from 'backbone';
import BackboneORM, { type CollectionConstructor, configureModel, type ConfiguredModelConstructor } from 'backbone-orm';

interface IsolationAttributes extends Backbone.ObjectHash {
  child_value?: string;
  name?: string;
  parent_value?: string;
}

type IsolationModel = Backbone.Model<IsolationAttributes>;
type PersistenceCallback = (this: void, error: Error | null) => void;

interface CacheStore {
  get(id: number | string): IsolationModel | undefined;
}

interface MemoryModelStatics {
  cache?: CacheStore;
  createSync(target: InputModelConstructor): Backbone.Model['sync'];
  cuid: string;
  store: IsolationAttributes[];
}

type MemoryModelConstructor = ConfiguredModelConstructor<InputModelConstructor> & MemoryModelStatics;

interface InputModelConstructor {
  new (attributes?: IsolationAttributes, options?: object): IsolationModel;
  extend(properties: object, classProperties?: object): InputModelConstructor;
  prototype: IsolationModel;
}

interface LegacyPersistenceModel {
  fetch(callback: PersistenceCallback): unknown;
  save(callback: PersistenceCallback): unknown;
}

const hasOwn = (value: object, key: PropertyKey): boolean => Reflect.getOwnPropertyDescriptor(value, key) !== undefined;

function save(model: IsolationModel): void {
  let callbackCount = 0;
  let error: Error | null | undefined;
  const returned = (model as IsolationModel & LegacyPersistenceModel).save((saveError) => {
    callbackCount += 1;
    error = saveError;
  });
  assert.strictEqual(returned, undefined);
  assert.strictEqual(callbackCount, 1);
  assert.ifError(error);
}

function fetch(model: IsolationModel): void {
  let callbackCount = 0;
  let error: Error | null | undefined;
  const returned = (model as IsolationModel & LegacyPersistenceModel).fetch((fetchError) => {
    callbackCount += 1;
    error = fetchError;
  });
  assert.strictEqual(returned, undefined);
  assert.strictEqual(callbackCount, 1);
  assert.ifError(error);
}

function fetchCollection(collection: Backbone.Collection<IsolationModel>): void {
  let callbackCount = 0;
  let error: unknown;
  const returned = collection.fetch({
    error(_collection, fetchError) {
      error = fetchError;
    },
    success(loaded) {
      callbackCount += 1;
      assert.strictEqual(loaded, collection);
    },
  });
  assert.strictEqual(returned, undefined);
  assert.strictEqual(callbackCount, 1);
  assert.ifError(error);
}

function createTypes(
  style: 'extend' | 'native',
  suffix: string
): {
  Child: InputModelConstructor;
  Parent: InputModelConstructor;
} {
  if (style === 'native') {
    class Parent extends Backbone.Model<IsolationAttributes> {
      get model_name() {
        return `MemoryIsolationNativeParent${suffix}`;
      }

      schema(): object {
        return { parent_value: 'String' };
      }
    }
    class Child extends Parent {
      get model_name() {
        return `MemoryIsolationNativeChild${suffix}`;
      }

      schema(): object {
        return { child_value: 'String' };
      }
    }
    return { Child, Parent };
  }

  const Parent = Backbone.Model.extend({
    model_name: `MemoryIsolationExtendParent${suffix}`,
    schema() {
      return { parent_value: 'String' };
    },
  });
  const Child = Parent.extend({
    model_name: `MemoryIsolationExtendChild${suffix}`,
    schema() {
      return { child_value: 'String' };
    },
  });
  return { Child, Parent };
}

function assertMemoryStatics(type: object): asserts type is MemoryModelStatics {
  const createSync: unknown = Reflect.get(type, 'createSync');
  const cuid: unknown = Reflect.get(type, 'cuid');
  const store: unknown = Reflect.get(type, 'store');
  const cache: unknown = Reflect.get(type, 'cache');
  assert.strictEqual(typeof createSync, 'function');
  assert.strictEqual(typeof cuid, 'string');
  assert.ok(Array.isArray(store));
  for (const attributes of store) {
    assert.ok(attributes && typeof attributes === 'object' && !Array.isArray(attributes));
    for (const key of ['child_value', 'name', 'parent_value']) {
      const value: unknown = Reflect.get(attributes, key);
      assert.ok(value === undefined || typeof value === 'string');
    }
  }
  if (cache !== undefined) {
    assert.ok(cache && typeof cache === 'object');
    assert.strictEqual(typeof Reflect.get(cache, 'get'), 'function');
  }
}

function configure<C extends InputModelConstructor>(type: C): ConfiguredModelConstructor<C> & MemoryModelStatics {
  const configured = configureModel(type);
  assertMemoryStatics(configured);
  return configured;
}

function createParent(style: 'extend' | 'native', suffix: string): InputModelConstructor {
  let Parent: InputModelConstructor;
  if (style === 'native') {
    Parent = class extends Backbone.Model<IsolationAttributes> {};
  } else {
    Parent = Backbone.Model.extend({});
  }
  Reflect.set(Parent.prototype, 'model_name', `MemoryPath${style}Parent${suffix}`);
  Reflect.set(Parent.prototype, 'schema', function schema(): object {
    return { name: 'String', parent_value: 'String' };
  });
  return Parent;
}

function createChild(style: 'extend' | 'native', Parent: InputModelConstructor, suffix: string, schemaOverride: boolean): InputModelConstructor {
  let Child: InputModelConstructor;
  if (style === 'native') {
    Child = class extends Parent {};
  } else {
    Child = Parent.extend({});
  }
  Reflect.set(Child.prototype, 'model_name', `MemoryPath${style}Child${suffix}`);
  if (schemaOverride) {
    Reflect.set(Child.prototype, 'schema', function schema(): object {
      return { child_value: 'String' };
    });
  }
  return Child;
}

function createMiddle(style: 'extend' | 'native', Parent: InputModelConstructor): InputModelConstructor {
  let Middle: InputModelConstructor;
  if (style === 'native') {
    Middle = class extends Parent {};
  } else {
    Middle = Parent.extend({});
  }
  const parentGet = Parent.prototype.get;
  Reflect.set(Middle.prototype, 'get', function get(this: IsolationModel, key: string): unknown {
    if (key === 'sentinel') return 'middle-override';
    return Reflect.apply(parentGet, this, [key]);
  });
  return Middle;
}

describe('memory constructor inheritance isolation', () => {
  for (const cacheEnabled of [false, true]) {
    for (const style of ['native', 'extend'] as const) {
      for (const order of ['parent-first', 'child-first'] as const) {
        it(`isolates ${style} constructors configured ${order} with cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
          BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
          const suffix = `${style}${order}${cacheEnabled ? 'Cache' : 'NoCache'}`;
          const types = createTypes(style, suffix);
          const first = order === 'parent-first' ? types.Parent : types.Child;
          const second = order === 'parent-first' ? types.Child : types.Parent;
          configure(first);
          configure(second);
          const Parent = types.Parent as MemoryModelConstructor;
          const Child = types.Child as MemoryModelConstructor;

          assert.ok(hasOwn(Parent.prototype, 'sync'));
          assert.ok(hasOwn(Child.prototype, 'sync'));
          for (const type of [Parent, Child]) {
            assert.ok(hasOwn(type, 'cache'));
            assert.ok(hasOwn(type, 'cuid'));
            assert.ok(hasOwn(type, 'schema'));
            assert.ok(hasOwn(type, 'store'));
          }
          assert.notStrictEqual(Parent.prototype.sync, Child.prototype.sync);
          assert.notStrictEqual(Parent.store, Child.store);
          assert.notStrictEqual(Parent.schema(), Child.schema());
          assert.notStrictEqual(Parent.cuid, Child.cuid);

          const parent = new Parent({ parent_value: 'parent' });
          const child = new Child({ child_value: 'child' });
          save(parent);
          const parentStoreAfterSave = JSON.stringify(Parent.store);
          save(child);
          assert.strictEqual(JSON.stringify(Parent.store), parentStoreAfterSave);
          assert.deepStrictEqual(Parent.store, [{ id: 1, parent_value: 'parent' }]);
          assert.deepStrictEqual(Child.store, [{ child_value: 'child', id: 1 }]);

          const parents = await Parent.find({ parent_value: 'parent' });
          const children = await Child.find({ child_value: 'child' });
          assert.strictEqual(parents.length, 1);
          assert.strictEqual(children.length, 1);
          assert.strictEqual((await Parent.find({ child_value: 'child' })).length, 0);
          assert.strictEqual((await Child.find({ parent_value: 'parent' })).length, 0);
          assert.strictEqual(parents[0].get('parent_value'), 'parent');
          assert.strictEqual(children[0].get('child_value'), 'child');

          const fetchedParent = new Parent({ id: parent.id });
          const fetchedChild = new Child({ id: child.id });
          fetch(fetchedParent);
          fetch(fetchedChild);
          assert.strictEqual(fetchedParent.get('parent_value'), 'parent');
          assert.strictEqual(fetchedParent.get('child_value'), undefined);
          assert.strictEqual(fetchedChild.get('child_value'), 'child');
          assert.strictEqual(fetchedChild.get('parent_value'), undefined);

          if (cacheEnabled) {
            assert.ok(Parent.cache);
            assert.ok(Child.cache);
            assert.notStrictEqual(Parent.cache, Child.cache);
            assert.strictEqual(Parent.cache.get(parent.id), parent);
            assert.strictEqual(Child.cache.get(child.id), child);
            assert.strictEqual(parents[0], parent);
            assert.strictEqual(children[0], child);
          } else {
            assert.strictEqual(Parent.cache, undefined);
            assert.strictEqual(Child.cache, undefined);
            assert.notStrictEqual(parents[0], parent);
            assert.notStrictEqual(children[0], child);
          }

          const identities = [Parent.prototype.sync, Child.prototype.sync, Parent.find, Child.find, Parent.schema, Child.schema, Parent.store, Child.store, Parent.cache, Child.cache];
          configure(Child);
          configure(Parent);
          assert.deepStrictEqual([Parent.prototype.sync, Child.prototype.sync, Parent.find, Child.find, Parent.schema, Child.schema, Parent.store, Child.store, Parent.cache, Child.cache], identities);
          assert.strictEqual((await Parent.find()).length, 1);
          assert.strictEqual((await Child.find()).length, 1);
        });
      }
    }
  }

  for (const cacheEnabled of [false, true]) {
    for (const style of ['native', 'extend'] as const) {
      it(`retains an inherited raw ${style} schema with cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
        BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
        const suffix = `InheritedSchema${cacheEnabled ? 'Cache' : 'NoCache'}`;
        const Parent = configure(createParent(style, suffix));
        const Child = configure(createChild(style, Parent, suffix, false));
        assert.notStrictEqual(Parent.schema(), Child.schema());
        assert.notStrictEqual(Parent.store, Child.store);

        const parent = new Parent({ parent_value: 'parent' });
        const child = new Child({ parent_value: 'child' });
        save(parent);
        save(child);
        const children = await Child.find({ parent_value: 'child' });
        assert.strictEqual(children.length, 1);
        assert.ok(children[0] instanceof Child);
        assert.strictEqual(children[0].get('parent_value'), 'child');
        assert.strictEqual((await Parent.find({ parent_value: 'child' })).length, 0);
        const fetched = new Child({ id: child.id });
        fetch(fetched);
        assert.strictEqual(fetched.get('parent_value'), 'child');
        assert.strictEqual(cacheEnabled ? children[0] === child : children[0] !== child, true);
      });

      it(`routes ${style} createSync through owned configuration with cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
        BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
        const suffix = `CreateSync${cacheEnabled ? 'Cache' : 'NoCache'}`;
        const Parent = configure(createParent(style, suffix));
        const ChildInput = createChild(style, Parent, suffix, false);
        ChildInput.prototype.sync = Parent.createSync(ChildInput);
        const firstSync = ChildInput.prototype.sync;
        const Child = configure(ChildInput);
        assert.strictEqual(Child.prototype.sync, firstSync);
        assert.notStrictEqual(Parent.prototype.sync, Child.prototype.sync);
        assert.notStrictEqual(Parent.store, Child.store);

        const parent = new Parent({ parent_value: 'parent' });
        const child = new Child({ parent_value: 'child' });
        save(parent);
        save(child);
        assert.strictEqual((await Parent.find({ parent_value: 'child' })).length, 0);
        const children = await Child.find({ parent_value: 'child' });
        assert.strictEqual(children.length, 1);
        assert.ok(children[0] instanceof Child);
        assert.strictEqual(cacheEnabled ? children[0] === child : children[0] !== child, true);
      });

      it(`preserves an intermediate ${style} get override with cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
        BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
        const suffix = `Intermediate${cacheEnabled ? 'Cache' : 'NoCache'}`;
        const Parent = configure(createParent(style, suffix));
        const Middle = createMiddle(style, Parent);
        const ChildInput = createChild(style, Middle, suffix, true);
        assert.strictEqual(new ChildInput().get('sentinel'), 'middle-override');
        const Child = configure(ChildInput);
        const child = new Child({ child_value: 'child' });
        assert.strictEqual(child.get('sentinel'), 'middle-override');
        save(child);
        const children = await Child.find({ child_value: 'child' });
        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0].get('sentinel'), 'middle-override');
        assert.strictEqual(children[0].get('child_value'), 'child');
      });
    }

    for (const style of ['native', 'extend'] as const) {
      for (const ownership of ['inherited', 'copied', 'independent'] as const) {
        it(`configures a ${style} collection model with ${ownership} owned sync and cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
          BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
          const suffix = `CollectionOwned${style}${ownership}${cacheEnabled ? 'Cache' : 'NoCache'}`;
          const ParentInput = createParent(style, suffix);
          const baseGet = ParentInput.prototype.get;
          const Parent = configure(ParentInput);
          const ChildInput = createChild(style, Parent, suffix, false);
          const urlRoot = `/collection-owned/${suffix}`;
          Reflect.set(ChildInput.prototype, 'urlRoot', urlRoot);
          Reflect.set(ChildInput.prototype, 'get', function get(this: IsolationModel, key: string): unknown {
            if (key === 'sentinel') return 'child-override';
            return Reflect.apply(baseGet, this, [key]);
          });

          if (ownership === 'copied') ChildInput.prototype.sync = Parent.prototype.sync;
          if (ownership === 'independent') configure(ChildInput);
          if (ownership === 'inherited') assert.ok(!hasOwn(ChildInput.prototype, 'sync'));
          if (ownership === 'copied') assert.ok(hasOwn(ChildInput.prototype, 'sync'));

          const CollectionType: CollectionConstructor<Backbone.Collection<IsolationModel>> = Backbone.Collection.extend({ model: ChildInput });
          CollectionType.prototype.sync = BackboneORM.sync(CollectionType);
          const collectionSync = CollectionType.prototype.sync;
          assert.strictEqual(BackboneORM.sync(CollectionType), collectionSync);
          assert.strictEqual(CollectionType.prototype.model, ChildInput);

          const Child = ChildInput as MemoryModelConstructor;
          assert.ok(hasOwn(Child.prototype, 'sync'));
          assert.notStrictEqual(Child.prototype.sync, Parent.prototype.sync);
          assert.notStrictEqual(Child.store, Parent.store);
          if (cacheEnabled) assert.notStrictEqual(Child.cache, Parent.cache);
          else assert.strictEqual(Child.cache, Parent.cache);
          assert.strictEqual(Reflect.get(Child.prototype, 'urlRoot'), urlRoot);
          assert.strictEqual(new Child().get('sentinel'), 'child-override');
          const nameField = (Child.schema() as { field(key: string): { type?: string } | undefined }).field('name');
          assert.strictEqual(nameField?.type, 'String');

          const saved = new Child({ name: 'child' });
          save(saved);
          assert.strictEqual((await Parent.find({ name: 'child' })).length, 0);
          const children = await Child.find({ name: 'child' });
          assert.strictEqual(children.length, 1);
          assert.ok(children[0] instanceof Child);
          assert.strictEqual(children[0].get('name'), 'child');

          const collection = new CollectionType();
          fetchCollection(collection);
          assert.strictEqual(collection.length, 1);
          assert.ok(collection.at(0) instanceof Child);
          assert.strictEqual(collection.at(0)?.get('name'), 'child');
          assert.strictEqual(cacheEnabled ? children[0] === saved : children[0] !== saved, true);
          assert.strictEqual(cacheEnabled ? collection.at(0) === saved : collection.at(0) !== saved, true);
          assert.strictEqual(BackboneORM.sync(CollectionType), collectionSync);
          assert.strictEqual(CollectionType.prototype.sync, collectionSync);
          assert.strictEqual((await Parent.find()).length, 0);
          assert.strictEqual((await Child.find()).length, 1);
        });
      }
    }

    it(`preserves collection memory loading and model identity with cache ${cacheEnabled ? 'on' : 'off'}`, () => {
      BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
      const suffix = cacheEnabled ? 'Cache' : 'NoCache';
      const ModelInput = createParent('extend', `Collection${suffix}`);
      const CollectionType: CollectionConstructor<Backbone.Collection<IsolationModel>> = Backbone.Collection.extend({ model: ModelInput });
      CollectionType.prototype.sync = BackboneORM.sync(CollectionType);
      const firstSync = CollectionType.prototype.sync;
      assert.strictEqual(BackboneORM.sync(CollectionType), firstSync);
      assert.strictEqual(CollectionType.prototype.model, ModelInput);
      const ModelType = ModelInput as MemoryModelConstructor;

      const saved = new ModelType({ parent_value: 'collection-row' });
      save(saved);
      const collection = new CollectionType();
      fetchCollection(collection);
      assert.strictEqual(collection.length, 1);
      assert.ok(collection.at(0) instanceof ModelType);
      assert.strictEqual(collection.at(0)?.get('parent_value'), 'collection-row');
      assert.strictEqual(cacheEnabled ? collection.at(0) === saved : collection.at(0) !== saved, true);
    });

    for (const declaration of ['implicit', 'default'] as const) {
      it(`generates a model for a collection with ${declaration} model and cache ${cacheEnabled ? 'on' : 'off'}`, async () => {
        BackboneORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
        const suffix = `${declaration}${cacheEnabled ? 'Cache' : 'NoCache'}`;
        const properties: { model?: typeof Backbone.Model; schema(): object; url: string } = {
          schema() {
            return { name: 'String' };
          },
          url: `/generated-collection/${suffix}`,
        };
        if (declaration === 'default') properties.model = Backbone.Model;
        const CollectionType: CollectionConstructor<Backbone.Collection<IsolationModel>> = Backbone.Collection.extend(properties);
        CollectionType.prototype.sync = BackboneORM.sync(CollectionType);
        const collectionSync = CollectionType.prototype.sync;
        const ModelType = CollectionType.prototype.model as MemoryModelConstructor;
        assert.notStrictEqual(ModelType, Backbone.Model);
        assert.ok(hasOwn(ModelType.prototype, 'sync'));
        assert.strictEqual(BackboneORM.sync(CollectionType), collectionSync);
        assert.strictEqual(CollectionType.prototype.model, ModelType);

        const saved = new ModelType({ name: 'generated' });
        save(saved);
        const found = await ModelType.find({ name: 'generated' });
        assert.strictEqual(found.length, 1);
        assert.ok(found[0] instanceof ModelType);
        const collection = new CollectionType();
        fetchCollection(collection);
        assert.strictEqual(collection.length, 1);
        assert.ok(collection.at(0) instanceof ModelType);
        assert.strictEqual(collection.at(0)?.get('name'), 'generated');
        assert.strictEqual(cacheEnabled ? found[0] === saved : found[0] !== saved, true);
        assert.strictEqual(cacheEnabled ? collection.at(0) === saved : collection.at(0) !== saved, true);
      });
    }
  }

  it('rejects an inherited caller adapter before changing the child constructor', () => {
    class Parent extends Backbone.Model<IsolationAttributes> {}
    const foreignSync: Backbone.Model['sync'] = Backbone.sync;
    Parent.prototype.sync = foreignSync;
    class Child extends Parent {}

    const constructorKeys = Reflect.ownKeys(Child);
    const prototypeKeys = Reflect.ownKeys(Child.prototype);
    assert.throws(() => configureModel(Child), /inherited sync adapter is not owned by backbone-orm/);
    assert.deepStrictEqual(Reflect.ownKeys(Child), constructorKeys);
    assert.deepStrictEqual(Reflect.ownKeys(Child.prototype), prototypeKeys);
    assert.strictEqual(Child.prototype.sync, foreignSync);
    assert.ok(!hasOwn(Child.prototype, 'sync'));
    assert.ok(!hasOwn(Child, 'store'));
    assert.ok(!hasOwn(Child, 'cache'));
    assert.ok(!hasOwn(Child, 'cuid'));
  });

  it('rejects a collection model caller adapter before changing either constructor', () => {
    class Parent extends Backbone.Model<IsolationAttributes> {}
    const foreignSync: Backbone.Model['sync'] = Backbone.sync;
    Parent.prototype.sync = foreignSync;
    class Child extends Parent {}
    const CollectionType: CollectionConstructor<Backbone.Collection<IsolationModel>> = Backbone.Collection.extend({ model: Child });
    const childConstructorKeys = Reflect.ownKeys(Child);
    const childPrototypeKeys = Reflect.ownKeys(Child.prototype);
    const collectionConstructorKeys = Reflect.ownKeys(CollectionType);
    const collectionPrototypeKeys = Reflect.ownKeys(CollectionType.prototype);

    assert.throws(() => BackboneORM.sync(CollectionType), /collection model Child with memory sync: its sync adapter is not owned by backbone-orm/);
    assert.deepStrictEqual(Reflect.ownKeys(Child), childConstructorKeys);
    assert.deepStrictEqual(Reflect.ownKeys(Child.prototype), childPrototypeKeys);
    assert.deepStrictEqual(Reflect.ownKeys(CollectionType), collectionConstructorKeys);
    assert.deepStrictEqual(Reflect.ownKeys(CollectionType.prototype), collectionPrototypeKeys);
    assert.strictEqual(Child.prototype.sync, foreignSync);
    assert.ok(!hasOwn(Child.prototype, 'sync'));
    assert.ok(!hasOwn(Child, 'store'));
    assert.ok(!hasOwn(CollectionType.prototype, 'sync'));
  });
});
