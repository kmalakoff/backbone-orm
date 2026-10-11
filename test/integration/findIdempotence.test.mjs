import assert from 'assert';
import Backbone from 'backbone';
import esmORM from 'backbone-orm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cjsORM = require('backbone-orm');

function save(model) {
  let error;
  const returned = model.save((saveError) => {
    error = saveError;
  });
  assert.strictEqual(returned, undefined);
  assert.ifError(error);
}

async function verifyStableFacade(modelType) {
  modelType.prototype.sync = cjsORM.sync(modelType);
  const first = modelType.find;
  assert.strictEqual(typeof first, 'function');
  assert.ok(Object.getOwnPropertyDescriptor(modelType, 'find'));
  assert.ok(first() instanceof Promise);
  await first();

  for (const configure of [cjsORM.Utils.configureModelType, esmORM.Utils.configureModelType]) {
    configure.call(cjsORM.Utils, modelType);
    assert.strictEqual(modelType.find, first);
    await modelType.find();
  }

  for (const orm of [cjsORM, esmORM]) {
    modelType.prototype.sync = orm.sync(modelType);
    assert.strictEqual(modelType.find, first);
    const result = modelType.find();
    assert.ok(result instanceof Promise);
    await result.catch((error) => assert.doesNotMatch(error.message, /callback is not a function/));
  }
}

describe('static find configuration ownership', () => {
  beforeEach(() => {
    cjsORM.configure({ model_cache: { enabled: false } });
  });

  it('shares one runtime across mixed CJS and ESM package imports', () => {
    assert.strictEqual(esmORM, cjsORM);
    assert.strictEqual(cjsORM.Backbone, Backbone);
    assert.strictEqual(esmORM.sync, cjsORM.sync);
    assert.strictEqual(esmORM.sync.Sync, cjsORM.sync.Sync);
    assert.strictEqual(esmORM.sync.Cursor, cjsORM.sync.Cursor);
    assert.strictEqual(esmORM.Fabricator, cjsORM.Fabricator);
    assert.strictEqual(esmORM.TestUtils, cjsORM.TestUtils);

    class DirectModel extends Backbone.Model {
      schema() {
        return {};
      }
    }
    DirectModel.prototype.model_name = 'MixedDirectMemorySyncModel';
    const direct = new cjsORM.sync.Sync(DirectModel);
    assert.ok(direct instanceof esmORM.sync.Sync);
    assert.strictEqual(direct.model_type, DirectModel);
  });

  it('retains the facade for independently configured Backbone.extend subclasses', async () => {
    const Parent = Backbone.Model.extend({
      model_name: 'IdempotentExtendParent',
      schema() {
        return {};
      },
    });
    const Child = Parent.extend({ model_name: 'IdempotentExtendChild' });

    await verifyStableFacade(Child);
    await verifyStableFacade(Parent);
    assert.notStrictEqual(Parent.find, Child.find);
  });

  it('retains the facade for independently configured native subclasses', async () => {
    class Parent extends Backbone.Model {
      schema() {
        return {};
      }
    }
    Parent.prototype.model_name = 'IdempotentNativeParent';

    class Child extends Parent {}
    Child.prototype.model_name = 'IdempotentNativeChild';

    await verifyStableFacade(Child);
    await verifyStableFacade(Parent);
    assert.notStrictEqual(Parent.find, Child.find);
  });

  it('shares isolated memory ownership across mixed imports and late-created children', async () => {
    cjsORM.configure({ model_cache: { enabled: true, max: 100 } });

    for (const style of ['native', 'extend']) {
      let Parent;
      if (style === 'native') {
        Parent = class extends Backbone.Model {
          get model_name() {
            return 'MixedLateNativeParent';
          }

          schema() {
            return { parent_value: 'String' };
          }
        };
      } else {
        Parent = Backbone.Model.extend({
          model_name: 'MixedLateExtendParent',
          schema() {
            return { parent_value: 'String' };
          },
        });
      }
      cjsORM.configureModel(Parent);

      let Child;
      if (style === 'native') {
        Child = class extends Parent {
          get model_name() {
            return 'MixedLateNativeChild';
          }

          schema() {
            return { child_value: 'String' };
          }
        };
      } else {
        Child = Parent.extend({
          model_name: 'MixedLateExtendChild',
          schema() {
            return { child_value: 'String' };
          },
        });
      }
      esmORM.configureModel(Child);

      const parent = new Parent({ parent_value: 'parent' });
      const child = new Child({ child_value: 'child' });
      save(parent);
      save(child);
      assert.notStrictEqual(Parent.store, Child.store);
      assert.notStrictEqual(Parent.cache, Child.cache);
      assert.strictEqual(Parent.cache.get(parent.id), parent);
      assert.strictEqual(Child.cache.get(child.id), child);
      assert.strictEqual((await Parent.find({ parent_value: 'parent' }))[0], parent);
      assert.strictEqual((await Child.find({ child_value: 'child' }))[0], child);

      const identities = [Parent.prototype.sync, Child.prototype.sync, Parent.store, Child.store, Parent.cache, Child.cache];
      esmORM.configureModel(Parent);
      cjsORM.configureModel(Child);
      assert.deepStrictEqual([Parent.prototype.sync, Child.prototype.sync, Parent.store, Child.store, Parent.cache, Child.cache], identities);
    }
  });
});
