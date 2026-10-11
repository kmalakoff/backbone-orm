import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

describe('memory Sync prototype overrides', () => {
  it('preserves subclass overrides, detached binding, and super calls', () => {
    class OverrideSync extends ORM.sync.Sync {
      deleteCB(_model, callback) {
        this.overrideCalled = true;
        return callback(null);
      }
    }

    class SuperSync extends ORM.sync.Sync {
      deleteCB(model, callback) {
        return super.deleteCB(model, callback);
      }
    }

    const OverrideModel = Backbone.Model.extend({
      model_name: 'MemorySyncOverrideModel',
      schema() {
        return {};
      },
    });
    const override = new OverrideSync(OverrideModel);
    assert.strictEqual(typeof ORM.sync.Sync.prototype.deleteCB, 'function');
    const detachedOverride = override.deleteCB;
    let overrideError;
    const overrideReturn = detachedOverride(new OverrideModel({ id: 7 }), (error) => {
      overrideError = error;
      return 'override-return';
    });
    assert.strictEqual(override.overrideCalled, true);
    assert.strictEqual(overrideError, null);
    assert.strictEqual(overrideReturn, 'override-return');

    const SuperModel = Backbone.Model.extend({
      model_name: 'MemorySyncSuperModel',
      schema() {
        return {};
      },
    });
    SuperModel.schema = SuperModel.prototype.schema;
    const superSync = new SuperSync(SuperModel);
    const created = new SuperModel({ name: 'created' });
    superSync.create(created, {
      success() {},
      error(error) {
        throw error;
      },
    });
    const detachedSuper = superSync.deleteCB;
    let superError;
    const superReturn = detachedSuper(created, (error) => {
      superError = error;
      return 'super-return';
    });
    assert.strictEqual(superError, null);
    assert.strictEqual(superReturn, 'super-return');
    assert.deepStrictEqual(superSync.store, []);
  });
});
