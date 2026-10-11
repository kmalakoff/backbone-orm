import assert from 'assert';
import Backbone from 'backbone';
import ORM, { configureModel } from 'backbone-orm';

describe('collection extensions', () => {
  it('uses cached package models, fetches without options, and preserves the installed boundary', () => {
    const prototype = Backbone.Collection.prototype as unknown as {
      fetch: Backbone.Collection['fetch'];
      _orm_original_fns?: object;
      _prepareModel: (...arguments_: unknown[]) => unknown;
    };
    ORM.configure({ model_cache: { enabled: true, max: 100 } });
    class ModelType extends Backbone.Model {
      get model_name() {
        return 'PublicCollectionExtensionModel';
      }

      schema() {
        return { name: 'String' };
      }
    }
    const Configured = configureModel(ModelType) as unknown as typeof ModelType & {
      cache: { get(id: unknown): Backbone.Model | undefined; set(id: unknown, model: Backbone.Model): unknown };
    };
    const installedFetch = prototype.fetch;
    const installedPrepareModel = prototype._prepareModel;
    const installedOriginals = prototype._orm_original_fns;
    const model = new Configured({ id: 91, name: 'first' });
    Configured.cache.set(91, model);
    const stored = new Configured({ name: 'stored' });
    let saveError: Error | null | undefined;
    (stored as unknown as { save(callback: (error: Error | null) => unknown): unknown }).save((error) => {
      saveError = error;
    });
    assert.ifError(saveError);
    const CollectionType = Backbone.Collection.extend({ model: Configured });
    CollectionType.prototype.sync = ORM.sync(CollectionType);
    const collection = new CollectionType();
    collection.add({ id: 91, name: 'updated' });
    assert.strictEqual(collection.at(0), model);
    assert.strictEqual(model.get('name'), 'updated');
    assert.doesNotThrow(() => collection.fetch());
    assert.strictEqual(collection.length, 1);
    assert.strictEqual(collection.at(0), stored);
    assert.strictEqual(prototype.fetch, installedFetch);
    assert.strictEqual(prototype._prepareModel, installedPrepareModel);
    assert.strictEqual(prototype._orm_original_fns, installedOriginals);
  });
});
