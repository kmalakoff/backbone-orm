import assert from 'assert';
import Backbone from 'backbone';

import ORM from 'backbone-orm';
import { destroy, dispatch, family, save, suspendUpdate } from '../../lib/deletionIntegrityModels.ts';
import observeModelDefaultContract from '../../lib/modelDefaultContractScenario.ts';
import observeModelExtensionContract from '../../lib/modelExtensionContractScenario.ts';

describe('model extensions', () => {
  for (const state of ['new', 'persisted'] as const) {
    it(`retries the same ${state} model after a real manual-ID belongsTo pre-save failure`, () => {
      class Related extends Backbone.Model {
        get _orm_never_cache() { return true; }
        get model_name() { return `PresaveRetryRelated${state}`; }
        schema() { return { id: ['Integer', { manual: true }], name: 'String' }; }
      }
      class SavingModel extends Backbone.Model {
        get _orm_never_cache() { return true; }
        get model_name() { return `PresaveRetrySaving${state}`; }
        schema() { return { name: 'String', related: () => ['belongsTo', Related] }; }
      }
      const ConfiguredRelated = ORM.configureModel(Related);
      const ConfiguredSaving = ORM.configureModel(SavingModel);
      assert.ok(!Reflect.get(ConfiguredRelated, 'cache') && !Reflect.get(ConfiguredSaving, 'cache'));
      const savingModel = new ConfiguredSaving({ name: 'before', related: null });
      if (state === 'persisted') save(savingModel);
      const related = new ConfiguredRelated({ name: 'related' });
      const events: string[] = [];
      const relatedErrors: unknown[] = [];
      savingModel.on('sync', () => events.push('sync'));
      savingModel.on('error', () => events.push('error'));
      related.on('error', (model, error) => {
        assert.strictEqual(model, related);
        relatedErrors.push(error);
      });
      try {
        savingModel.set({ name: 'retry', related });
        const failureCalls: unknown[][] = [];
        const failureReceivers: unknown[] = [];
        const failedReturn = Reflect.apply(savingModel.save, savingModel, [function (this: unknown, ...arguments_: unknown[]) {
          failureReceivers.push(this);
          failureCalls.push(arguments_);
          events.push('failure-callback');
          return 'failure-result';
        }]);
        assert.strictEqual(failedReturn, 'failure-result');
        assert.strictEqual(failureCalls.length, 1);
        assert.strictEqual(failureCalls[0].length, 4);
        const failure = failureCalls[0][0];
        assert.ok(failure instanceof Error);
        assert.match(failure.message, /^Create should not be called for a manual id\. Set an id before calling save\./);
        assert.strictEqual(relatedErrors.length, 1);
        assert.strictEqual(relatedErrors[0], failure);
        assert.strictEqual(failureCalls[0][1], savingModel);
        assert.strictEqual(failureCalls[0][2], failure);
        assert.deepStrictEqual(failureCalls[0][3], {});
        assert.deepStrictEqual(failureReceivers, [undefined]);
        assert.deepStrictEqual(events, ['failure-callback']);
        assert.strictEqual(savingModel.id, state === 'persisted' ? 1 : undefined);
        assert.strictEqual(related.id, undefined);
        assert.strictEqual(savingModel.get('related'), related);
        assert.strictEqual(savingModel.get('name'), 'retry');

        const failedRows: unknown[] = [];
        ConfiguredSaving.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          failedRows.push(rows);
        });
        ConfiguredRelated.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          failedRows.push(rows);
        });
        assert.deepStrictEqual(failedRows, [state === 'persisted' ? [{ id: 1, name: 'before' }] : [], []]);

        related.set('id', 7);
        save(related);
        const repairedRows: unknown[] = [];
        ConfiguredSaving.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          repairedRows.push(rows);
        });
        ConfiguredRelated.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          repairedRows.push(rows);
        });
        assert.deepStrictEqual(repairedRows, [
          state === 'persisted' ? [{ id: 1, name: 'before' }] : [],
          [{ id: 7, name: 'related' }],
        ]);

        const retryCalls: unknown[][] = [];
        const retryReceivers: unknown[] = [];
        const retriedReturn = Reflect.apply(savingModel.save, savingModel, [function (this: unknown, ...arguments_: unknown[]) {
          retryReceivers.push(this);
          retryCalls.push(arguments_);
          events.push('retry-callback');
          return 'retry-result';
        }]);
        const retriedRows: unknown[] = [];
        ConfiguredSaving.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          retriedRows.push(rows);
        });
        ConfiguredRelated.cursor().toJSON((error, rows) => {
          assert.ifError(error);
          retriedRows.push(rows);
        });
        assert.strictEqual(retryCalls.length, 1);
        assert.strictEqual(retryCalls[0].length, 4);
        assert.ifError(retryCalls[0][0]);
        assert.deepStrictEqual(retriedRows, [[{ id: 1, name: 'retry', related_id: 7 }], [{ id: 7, name: 'related' }]]);
        assert.strictEqual(retryCalls[0][0], null);
        assert.strictEqual(retryCalls[0][1], savingModel);
        assert.deepStrictEqual(retryCalls[0][2], { id: 1, name: 'retry', related_id: 7 });
        assert.deepStrictEqual(retryCalls[0][3], {});
        assert.deepStrictEqual(retryReceivers, [undefined]);
        assert.strictEqual(retriedReturn, undefined);
        assert.deepStrictEqual(events, ['failure-callback', 'retry-callback', 'sync']);
        assert.strictEqual(savingModel.id, 1);
        assert.strictEqual(savingModel.get('related'), related);
      } finally {
        savingModel.off();
        related.off();
      }
    });
  }

  it('exposes the published package-name callback and iteration behavior', async () => {
    const observation = await observeModelExtensionContract(ORM, 'Public');
    const each = observation.each as Record<string, unknown>;
    const model = observation.model as Record<string, unknown>;
    assert.deepStrictEqual(each.order, [1, 2, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(each.errorOrder, [1, 2, 3]);
    assert.strictEqual(each.errorIdentity, true);
    assert.deepStrictEqual(observation.streamIds, [1, 2, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(observation.intervalStarts, ['2020-01-01T00:00:00.000Z', '2020-01-03T00:00:00.000Z', '2020-01-05T00:00:00.000Z', '2020-01-07T00:00:00.000Z']);
    assert.strictEqual(model.getReturn, 'string:name-1');
    assert.deepStrictEqual(model.getArguments, ['null', 'string:name-1']);
  });

  it('normalizes published null defaults without poisoning serialization', async () => {
    const observation = await observeModelDefaultContract(ORM, 'Public');
    assert.deepStrictEqual(observation.modelFetch, { returned: 'undefined', threw: null, value: undefined });
    assert.deepStrictEqual(observation.staticCursor, { error: null, value: [{ id: 1, name: 'saved' }] });
    assert.deepStrictEqual(observation.stream, { error: null, ids: [1] });
    assert.deepStrictEqual(observation.instanceCursor, { error: null, value: [] });
    assert.deepStrictEqual(observation.toJSON, {
      jsonDepthAfterNormal: 0,
      jsonDepthAfterNull: 0,
      normalJSON: { returned: 'object:[object Object]', threw: null, value: { id: 1, name: 'saved' } },
      nullJSON: { returned: 'object:[object Object]', threw: null, value: { id: 1, name: 'saved' } },
      sameIdentity: false,
    });
  });

  it('leaves unsaved destruction, wait and ordinary events to Backbone', async () => {
    const { Parent, Child } = family(true);
    const unsaved = new Parent();
    const unsavedEvents: string[] = [];
    unsaved.on('destroy', () => unsavedEvents.push('destroy'));
    assert.strictEqual(
      destroy(unsaved, (error) => {
        assert.ifError(error);
        unsavedEvents.push('callback');
      }),
      false
    );
    assert.deepStrictEqual(unsavedEvents, ['destroy']);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(unsavedEvents, ['destroy', 'callback']);
    assert.deepStrictEqual(Parent.store, []);

    for (const wait of [false, true]) {
      const parent = new Parent({ id: wait ? 2 : 1 });
      save(parent);
      save(new Child({ parent }));
      const resume = suspendUpdate(Child);
      const events: string[] = [];
      parent.on('destroy', () => events.push('destroy'));
      parent.on('sync', () => events.push('sync'));
      destroy(
        parent,
        (error) => {
          assert.ifError(error);
          events.push('callback');
        },
        { wait }
      );
      assert.deepStrictEqual(events, wait ? [] : ['destroy']);
      assert.strictEqual(Parent.cache?.get(parent.id), parent);
      resume();
      assert.deepStrictEqual(events, ['destroy', 'callback', 'sync']);
    }
  });

  it('keeps the unregistered adapter path even when it delegates to real memory', () => {
    const { Parent } = family(true);
    const parent = new Parent({ id: 1 });
    save(parent);
    const original = Parent.prototype.sync;
    const checks: boolean[] = [];
    Parent.prototype.sync = function delegated(method: string, ...arguments_: unknown[]) {
      if (method === 'delete') checks.push(Parent.cache?.get(1) === undefined);
      return Reflect.apply(original, this, [method, ...arguments_]);
    };
    let count = 0;
    destroy(parent, (error) => {
      assert.ifError(error);
      count++;
    });
    assert.deepStrictEqual(checks, [true]);
    assert.strictEqual(count, 1);
    assert.deepStrictEqual(Parent.store, []);
  });

  it('rejects unsupported relation hooks before Backbone destroy effects with ordinary error ownership', () => {
    const { Parent, Child } = family(true);
    const parent = new Parent({ id: 1 });
    save(parent);
    const child = new Child({ parent });
    save(child);
    const relation = Child.schema().relations.parent;
    const original = Reflect.get(relation, 'patchRemove') as (...arguments_: unknown[]) => unknown;
    let overrideCalls = 0;
    Reflect.set(relation, 'patchRemove', function overridden(this: unknown, ...arguments_: unknown[]): unknown {
      overrideCalls++;
      return Reflect.apply(original, this, arguments_);
    });
    const row = Child.store[0];
    const context = { owner: 'error-handler-context' };
    const events: string[] = [];
    let callbackCount = 0;
    let callbackError: unknown;
    let callbackOptions: unknown;
    child.on('destroy', () => events.push('destroy'));
    child.on('sync', () => events.push('sync'));
    child.on('error', (model, error, options) => {
      assert.strictEqual(model, child);
      assert.strictEqual(error, callbackError);
      assert.strictEqual(options, callbackOptions);
      events.push('error');
    });
    const options = {
      context,
      wait: false,
      error(this: unknown, model: unknown, error: Error, passedOptions: unknown) {
        assert.strictEqual(this, context);
        assert.strictEqual(model, child);
        assert.match(error.message, /Unsupported relation\.patchRemove override/);
        callbackError = error;
        callbackOptions = passedOptions;
        callbackCount++;
        events.push('callback');
        return 'callback-result-is-not-a-request';
      },
    };
    assert.strictEqual(Reflect.apply(child.destroy, child, [options]), undefined);
    assert.strictEqual(callbackCount, 1);
    assert.notStrictEqual(callbackOptions, options);
    assert.deepStrictEqual(events, ['callback', 'error']);
    assert.strictEqual(overrideCalls, 0);
    assert.strictEqual(Child.store[0], row);
    assert.strictEqual(Child.cache?.get(child.id), child);
    assert.strictEqual(child.get('parent'), parent);
    ORM.configure({ model_cache: { enabled: false } });
  });

  it('shares the proven owned-deletion contract between public CJS/ESM roots', async () => {
    const { createRequire } = await import('node:module');
    const cjs = createRequire(import.meta.url)('backbone-orm') as typeof ORM;
    const esm = (await import('backbone-orm')).default;
    assert.strictEqual(cjs, esm);
    const { Parent, Child } = family(true);
    const parent = new Parent({ id: 1 });
    save(parent);
    save(new Child({ parent }));
    assert.strictEqual(cjs.sync(Parent), esm.sync(Parent));
    const resume = suspendUpdate(Child);
    let count = 0;
    destroy(parent, (error) => {
      assert.ifError(error);
      count++;
    });
    assert.strictEqual(Parent.cache?.get(1), parent);
    resume();
    assert.strictEqual(count, 1);
    assert.strictEqual(Parent.cache?.get(1), undefined);
    assert.strictEqual(dispatch(Parent, 'isRemote'), false);
  });
});
