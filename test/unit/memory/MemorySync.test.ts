import assert from 'assert';
import ORM from 'backbone-orm';

import { destroy, dispatch, family, memoryWorker, modelType, rejectUpdate, save, suspendUpdate } from '../../lib/deletionIntegrityModels.ts';

describe('MemorySync deletion integrity', () => {
  afterEach(() => ORM.configure({ model_cache: { enabled: false } }));

  for (const cache of [false, true]) {
    it(`deletes a real belongs-to row without replacing its captured owner, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      const book = new Child({ parent, name: 'book' });
      save(book);
      const captured = Child.store[0];
      let count = 0;
      destroy(book, (error) => {
        assert.ifError(error);
        count++;
      });
      assert.strictEqual(count, 1);
      assert.ok(!Child.store.includes(captured));
      assert.strictEqual(Child.store.length, 0);
      assert.strictEqual(Parent.store.length, 1);
      assert.strictEqual(Child.cache?.get(book.id), undefined);
    });

    it(`retains the exact target and original error when real reverse cleanup fails, cache=${cache}`, () => {
      const { Parent, Child, foreignKey } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      const child = new Child({ parent });
      save(child);
      const captured = Parent.store[0];
      const failure = new Error('intentional-relation-callback-failure');
      rejectUpdate(Child, failure);
      let count = 0;
      destroy(parent, (error) => {
        assert.strictEqual(error, failure);
        count++;
      });
      assert.strictEqual(count, 1);
      assert.strictEqual(Parent.store[0], captured);
      assert.strictEqual(Child.store[0][foreignKey], parent.id);
      if (cache) assert.strictEqual(Parent.cache?.get(parent.id), parent);
    });

    it(`rejects a suspended-cleanup same-ID replacement without deleting it, cache=${cache}`, () => {
      const { Parent, Child, foreignKey } = family(cache);
      const parent = new Parent({ id: 1, name: 'old' });
      save(parent);
      const child = new Child({ parent });
      save(child);
      const captured = Parent.store[0];
      const resume = suspendUpdate(Child);
      let count = 0;
      let failure: Error | null | undefined;
      destroy(parent, (error) => {
        failure = error;
        count++;
      });
      assert.strictEqual(count, 0);
      assert.strictEqual(Parent.store[0], captured);
      const replacement = new Parent({ id: 1, name: 'replacement' });
      save(replacement);
      const replacementRow = Parent.store[0];
      resume();
      assert.strictEqual(count, 1);
      assert.match(failure?.message ?? '', /Deletion conflict/);
      assert.strictEqual(Parent.store[0], replacementRow);
      assert.strictEqual(Child.store[0][foreignKey], null);
      if (cache) assert.strictEqual(Parent.cache?.get(parent.id), replacement);
    });

    it(`keeps partial batch completion and unrelated survivors, cache=${cache}`, () => {
      const { Parent, Child, foreignKey } = family(cache);
      const parents = [1, 2, 3].map((id) => {
        const model = new Parent({ id });
        save(model);
        return model;
      });
      parents.forEach((parent) => save(new Child({ parent })));
      const rows = Parent.store.slice();
      const failure = new Error('batch-callback-failure');
      rejectUpdate(Child, failure, (model) => model.get(foreignKey) === null && model.id === 2);
      let count = 0;
      dispatch(Parent, 'destroy', {}, (error: Error) => {
        assert.strictEqual(error, failure);
        count++;
      });
      assert.strictEqual(count, 1);
      assert.deepStrictEqual(Parent.store, [rows[0], rows[1]]);
      assert.strictEqual(Child.store[0][foreignKey], 1);
      assert.strictEqual(Child.store[1][foreignKey], 2);
      assert.strictEqual(Child.store[2][foreignKey], null);
      if (cache) {
        assert.strictEqual(Parent.cache?.get(1), parents[0]);
        assert.strictEqual(Parent.cache?.get(2), parents[1]);
        assert.strictEqual(Parent.cache?.get(3), undefined);
      }
    });

    it(`excludes new rows from destroy-all's captured snapshot, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      save(new Child({ parent }));
      const resume = suspendUpdate(Child);
      let count = 0;
      dispatch(Parent, 'destroy', {}, (error: Error) => {
        assert.ifError(error);
        count++;
      });
      const later = new Parent({ id: 2 });
      save(later);
      const laterRow = Parent.store[1];
      resume();
      assert.strictEqual(count, 1);
      assert.deepStrictEqual(Parent.store, [laterRow]);
      if (cache) assert.strictEqual(Parent.cache?.get(2), later);
    });

    it(`reports a disappeared target after cleanup without removing another row, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      save(new Child({ parent }));
      const survivor = new Parent({ id: 2 });
      save(survivor);
      const survivorRow = Parent.store[1];
      const resume = suspendUpdate(Child);
      let count = 0;
      destroy(parent, (error) => {
        assert.match(error?.message ?? '', /Deletion conflict/);
        count++;
      });
      Parent.store.splice(0, 1);
      resume();
      assert.strictEqual(count, 1);
      assert.deepStrictEqual(Parent.store, [survivorRow]);
    });

    it(`rejects exposed sync.store rebinding without mutating either array, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      save(new Child({ parent }));
      const worker = memoryWorker(Parent);
      const capturedStore = worker.store;
      const captured = capturedStore[0];
      const resume = suspendUpdate(Child);
      let count = 0;
      let failure: Error | null | undefined;
      destroy(parent, (error) => {
        failure = error;
        count++;
      });
      const replacementStore = [
        { id: 9, name: 'unrelated-first' },
        { id: 10, name: 'unrelated-last' },
      ];
      const replacementRows = replacementStore.slice();
      worker.store = replacementStore;
      assert.strictEqual(Parent.store, capturedStore);
      resume();
      assert.strictEqual(count, 1);
      assert.match(failure?.message ?? '', /Deletion conflict/);
      assert.strictEqual(worker.store, replacementStore);
      assert.deepStrictEqual(replacementStore, replacementRows);
      assert.deepStrictEqual(capturedStore, [captured]);
      if (cache) assert.strictEqual(Parent.cache?.get(1), parent);
    });

    it(`does not rebind the sync worker when only model.store changes, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      save(new Child({ parent }));
      const worker = memoryWorker(Parent);
      const capturedStore = worker.store;
      const resume = suspendUpdate(Child);
      let count = 0;
      destroy(parent, (error) => {
        assert.ifError(error);
        count++;
      });
      const modelStore = [{ id: 9, name: 'model-static-only' }];
      Parent.store = modelStore;
      assert.strictEqual(worker.store, capturedStore);
      resume();
      assert.strictEqual(count, 1);
      assert.deepStrictEqual(capturedStore, []);
      assert.strictEqual(Parent.store, modelStore);
      assert.deepStrictEqual(modelStore, [{ id: 9, name: 'model-static-only' }]);
      assert.strictEqual(Parent.cache?.get(1), undefined);
    });

    it(`rejects sync.store rebinding while queried cursor selection is yielding, cache=${cache}`, async () => {
      ORM.configure({ model_cache: { enabled: cache, max: 5000 } });
      const Type = modelType('QueryRebind', () => ({ id: ['Integer', { manual: true }] }));
      for (let id = 1; id <= 2001; id++) save(new Type({ id, group: 'remove' }));
      const worker = memoryWorker(Type);
      const capturedStore = worker.store;
      const capturedRows = capturedStore.slice();
      let callbackCount = 0;
      const completed = new Promise<void>((resolve, reject) => {
        dispatch(Type, 'destroy', { group: 'remove' }, (error: Error) => {
          callbackCount++;
          try {
            assert.match(error?.message ?? '', /Deletion conflict/);
            resolve();
          } catch (failure) {
            reject(failure);
          }
        });
      });
      assert.strictEqual(callbackCount, 0, 'The real cursor must yield before deletion');
      const replacementStore = [{ id: 2001, group: 'survive' }];
      worker.store = replacementStore;
      await completed;
      assert.strictEqual(callbackCount, 1);
      assert.deepStrictEqual(replacementStore, [{ id: 2001, group: 'survive' }]);
      assert.deepStrictEqual(capturedStore, capturedRows);
      assert.strictEqual(Type.store, capturedStore);
    });

    it(`cleans custom-ID raw rows without changing their source identities, cache=${cache}`, () => {
      const { Parent, Child, foreignKey } = family(cache, true);
      const parent = new Parent({ _id: 7 });
      save(parent);
      save(new Child({ parent }));
      const row = Parent.store[0];
      let count = 0;
      dispatch(Parent, 'destroy', {}, (error: Error) => {
        assert.ifError(error);
        count++;
      });
      assert.strictEqual(count, 1);
      assert.strictEqual(row._id, 7);
      assert.strictEqual(row.id, undefined);
      assert.deepStrictEqual(Parent.store, []);
      assert.strictEqual(Child.store[0][foreignKey], null);
      assert.strictEqual(Parent.cache?.get(7), undefined);
    });

    it(`preserves required other-row self-relation writes, cache=${cache}`, () => {
      ORM.configure({ model_cache: { enabled: cache, max: 100 } });
      let Person: ReturnType<typeof modelType>;
      Person = modelType('Self', () => ({ id: ['Integer', { manual: true }], manager: () => ['belongsTo', Person, { as: 'reports' }], reports: () => ['hasMany', Person, { as: 'manager' }] }));
      const manager = new Person({ id: 1 });
      save(manager);
      manager.set('manager', manager);
      save(manager);
      const report = new Person({ id: 2, manager });
      save(report);
      const foreignKey = Person.schema().relations.manager.foreign_key;
      let count = 0;
      destroy(manager, (error) => {
        assert.ifError(error);
        count++;
      });
      assert.strictEqual(count, 1);
      assert.strictEqual(Person.store.length, 1);
      assert.strictEqual(Person.store[0].id, 2);
      assert.strictEqual(Person.store[0][foreignKey], null);
    });
  }
});
