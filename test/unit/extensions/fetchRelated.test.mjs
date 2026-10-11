import assert from 'assert';
import Backbone from 'backbone';
import { configureModel } from 'backbone-orm';

describe('public fetchRelated callback contract', () => {
  it('loads real pending relations with callback-only, string and array selectors', async () => {
    function save(model) {
      let calls = 0;
      model.save((error) => {
        assert.ifError(error);
        calls += 1;
      });
      assert.strictEqual(calls, 1, 'Real memory save must complete once');
    }

    class UncachedModel extends Backbone.Model {
      get _orm_never_cache() { return true; }
    }

    for (const form of ['callback', 'string', 'array']) {
      class Parent extends UncachedModel {
        get model_name() { return `FetchRelatedCallbackParent${form}`; }
        schema() {
          return {
            id: ['Integer', { manual: true }],
            children: () => ['hasMany', Child, { as: 'parent' }],
            profile: () => ['hasOne', Profile, { as: 'parent' }],
          };
        }
      }
      class Child extends UncachedModel {
        get model_name() { return `FetchRelatedCallbackChild${form}`; }
        schema() { return { id: ['Integer', { manual: true }], parent: () => ['belongsTo', Parent, { as: 'children' }] }; }
      }
      class Profile extends UncachedModel {
        get model_name() { return `FetchRelatedCallbackProfile${form}`; }
        schema() { return { id: ['Integer', { manual: true }], parent: () => ['belongsTo', Parent, { as: 'profile' }] }; }
      }

      const ConfiguredParent = configureModel(Parent);
      const ConfiguredChild = configureModel(Child);
      const ConfiguredProfile = configureModel(Profile);
      assert.ok(!Parent.cache && !Child.cache && !Profile.cache);
      const savedParent = new ConfiguredParent({ id: 1 });
      save(savedParent);
      save(new ConfiguredChild({ id: 2, parent: savedParent }));
      save(new ConfiguredChild({ id: 3, parent: savedParent }));
      save(new ConfiguredProfile({ id: 4, parent: savedParent }));

      const parent = new ConfiguredParent({ id: 1 });
      assert.notStrictEqual(parent, savedParent);
      assert.strictEqual(parent.isLoaded('children'), false);
      assert.strictEqual(parent.isLoaded('profile'), false);
      assert.deepStrictEqual(parent.get('children').pluck('id'), []);
      assert.strictEqual(parent.get('profile'), null);
      let calls = 0;
      await new Promise((resolve, reject) => {
        const callback = (...arguments_) => {
          calls += 1;
          assert.strictEqual(arguments_.length, 1);
          if (arguments_[0]) reject(arguments_[0]);
          else resolve();
        };
        if (form === 'callback') parent.fetchRelated(callback);
        else if (form === 'string') parent.fetchRelated('children', callback);
        else parent.fetchRelated(['profile'], callback);
      });
      assert.strictEqual(calls, 1);
      assert.strictEqual(parent.isLoaded('children'), form !== 'array');
      assert.strictEqual(parent.isLoaded('profile'), form !== 'string');
      assert.deepStrictEqual(parent.get('children').pluck('id').sort(), form === 'array' ? [] : [2, 3]);
      assert.strictEqual(parent.get('profile')?.id ?? null, form === 'string' ? null : 4);
      if (form === 'callback') {
        let completedCalls = 0;
        const returned = parent.fetchRelated((error) => {
          assert.ifError(error);
          completedCalls += 1;
          return 'completed-relations';
        });
        assert.strictEqual(returned, 'completed-relations');
        assert.strictEqual(completedCalls, 1);
      }
    }
  });
});

describe('public configured-instance load-state contract', () => {
  it('preserves initial and preconfigured flags and loads real saved relations independently of model state', async () => {
    function save(model) {
      let calls = 0;
      model.save((error) => {
        assert.ifError(error);
        calls += 1;
      });
      assert.strictEqual(calls, 1, 'Real memory save must complete once');
    }

    class UncachedModel extends Backbone.Model {
      get _orm_never_cache() { return true; }
    }

    for (const state of ['initial', 'preloaded', 'pending']) {
      let preinitializations = 0;
      class Parent extends UncachedModel {
        get model_name() { return `LoadStateParent${state}`; }
        schema() {
          return {
            id: ['Integer', { manual: true }],
            children: () => ['hasMany', Child, { as: 'parent' }],
          };
        }
      }
      class Child extends UncachedModel {
        get model_name() { return `LoadStateChild${state}`; }
        schema() { return { id: ['Integer', { manual: true }], parent: () => ['belongsTo', Parent, { as: 'children' }] }; }
      }

      const ConfiguredParent = configureModel(Parent);
      const ConfiguredChild = configureModel(Child);
      ConfiguredParent.prototype.preinitialize = function preinitialize() {
        preinitializations += 1;
        assert.strictEqual(this.isLoaded(), true);
        assert.strictEqual(this.isLoaded('children'), true);
        assert.strictEqual(this.isLoadedExists(), false);
        assert.strictEqual(this.isLoadedExists('children'), false);
        if (state === 'initial') return;
        assert.strictEqual(this.setLoaded(true), false);
        assert.strictEqual(this.setLoaded(false), true);
        assert.strictEqual(this.setLoaded('children', true), false);
        assert.strictEqual(this.setLoaded('children', false), true);
        if (state === 'preloaded') assert.strictEqual(this.setLoaded('children', true), false);
        assert.strictEqual(this.isLoaded(), false);
        assert.strictEqual(this.isLoaded('children'), state === 'preloaded');
        assert.strictEqual(this.isLoadedExists(), true);
        assert.strictEqual(this.isLoadedExists('children'), true);
      };
      assert.ok(!Parent.cache && !Child.cache);
      const savedParent = new ConfiguredParent({ id: 1 });
      assert.strictEqual(preinitializations, 1);
      assert.strictEqual(savedParent.isLoaded(), state === 'initial');
      assert.strictEqual(savedParent.isLoadedExists(), state !== 'initial');
      assert.strictEqual(savedParent.isLoaded('children'), state === 'preloaded');
      assert.strictEqual(savedParent.isLoadedExists('children'), state !== 'preloaded');
      assert.strictEqual(savedParent.setLoaded(false), true);
      assert.strictEqual(savedParent.isLoaded(), false);
      assert.strictEqual(savedParent.isLoaded(undefined), true);
      assert.strictEqual(savedParent.isLoaded('children'), state === 'preloaded');
      assert.strictEqual(savedParent.setLoaded(true), undefined);
      assert.strictEqual(savedParent.isLoaded(), true);
      assert.strictEqual(savedParent.isLoadedExists(), false);
      assert.strictEqual(savedParent.setLoaded('children', false), true);
      assert.strictEqual(savedParent.isLoaded('children'), false);
      assert.strictEqual(savedParent.isLoaded(), true);
      assert.strictEqual(savedParent.setLoaded('children', true), undefined);
      assert.strictEqual(savedParent.isLoaded('children'), true);
      assert.strictEqual(savedParent.isLoadedExists('children'), false);
      save(savedParent);
      save(new ConfiguredChild({ id: 2, parent: savedParent }));

      const previousPreinitializations = preinitializations;
      const parent = new ConfiguredParent({ id: 1 });
      assert.strictEqual(preinitializations, previousPreinitializations + 1);
      assert.notStrictEqual(parent, savedParent);
      assert.strictEqual(parent.setLoaded(true), undefined);
      assert.strictEqual(parent.setLoaded('children', false), true);
      assert.deepStrictEqual(parent.get('children').pluck('id'), []);
      let calls = 0;
      await new Promise((resolve, reject) => {
        parent.fetchRelated('children', (error) => {
          calls += 1;
          if (error) reject(error);
          else resolve();
        });
      });
      assert.strictEqual(calls, 1);
      assert.deepStrictEqual(parent.get('children').pluck('id'), [2]);
      assert.strictEqual(parent.isLoaded('children'), true);
      assert.strictEqual(parent.isLoadedExists('children'), false);
      assert.strictEqual(parent.isLoaded(), true);
      assert.strictEqual(parent.isLoadedExists(), false);
      assert.strictEqual(parent.setLoaded(false), true);
      assert.strictEqual(parent.isLoaded(), false);
      assert.strictEqual(parent.isLoaded('children'), true);
      assert.strictEqual(parent.setLoaded(true), undefined);
      assert.strictEqual(parent.isLoaded(), true);
      assert.strictEqual(parent.isLoaded('children'), true);
    }
  });
});
