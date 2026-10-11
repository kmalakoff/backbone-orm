import assert from 'assert';
import Backbone from 'backbone';
import ORM, { type CursorInstance } from 'backbone-orm';

let jsonSaveSequence = 0;

function jsonSaveType(cache: boolean, manual = true) {
  ORM.configure({ model_cache: { enabled: cache, max: 100 } });
  class JSONSaveModel extends Backbone.Model {
    static model_name = `UtilsJSONSave${jsonSaveSequence++}`;
    static store: Record<string, unknown>[] = [];
    urlRoot = 'memory://utils-model-json-save/items';
    schema() {
      return { id: manual ? ['Integer', { manual: true }] : 'Integer' };
    }
  }
  JSONSaveModel.prototype.sync = ORM.sync(JSONSaveModel);
  return JSONSaveModel;
}

function saveJSONFixture(model: Backbone.Model): void {
  let completed = 0;
  model.save(null, {
    success: () => {
      completed++;
    },
    error: (_model, error: Error) => {
      throw error;
    },
  });
  assert.strictEqual(completed, 1);
}

async function materialize(cursor: CursorInstance): Promise<Backbone.Model[]> {
  let calls = 0;
  const result = await new Promise<Backbone.Model[]>((resolve, reject) => {
    cursor.toModels((error, models) => {
      calls++;
      if (error) reject(error);
      else if (!Array.isArray(models)) reject(new Error('Expected full model array'));
      else resolve(models);
    });
  });
  assert.strictEqual(calls, 1);
  return result;
}

describe('Utils', () => {
  afterEach(() => ORM.configure({ model_cache: { enabled: false } }));

  for (const cache of [false, true]) {
    it(`materializes zero-ID object queries with current attributes and independent owners, cache=${cache}`, async () => {
      const Type = jsonSaveType(cache);
      const Configured = ORM.configureModel(Type);
      assert.strictEqual(Configured, Type);
      const zero = new Type({ id: 0, name: 'zero', _rev: 1 });
      const survivor = new Type({ id: 1, name: 'survivor', _rev: 1 });
      saveJSONFixture(zero);
      saveJSONFixture(survivor);

      const first = (await materialize(Configured.cursor({ id: 0 })))[0];
      const second = (await materialize(Configured.cursor({ id: 0 })))[0];
      const found = (await Configured.find({ id: 0 }))[0];
      assert.deepStrictEqual(first.toJSON(), { id: 0, name: 'zero', _rev: 1 });
      if (cache) {
        assert.strictEqual(first, zero);
        assert.strictEqual(second, zero);
        assert.strictEqual(found, zero);
      } else {
        assert.notStrictEqual(first, zero);
        assert.notStrictEqual(second, first);
        assert.notStrictEqual(found, second);
      }

      const stored = Type.store.find((row) => row.id === 0);
      assert.ok(stored);
      stored.name = 'updated';
      stored._rev = 2;
      const updated = (await materialize(Configured.cursor({ id: 0 })))[0];
      assert.deepStrictEqual(updated.toJSON(), { id: 0, name: 'updated', _rev: 2 });
      if (cache) {
        assert.strictEqual(updated, zero);
        assert.deepStrictEqual(zero.toJSON(), updated.toJSON());
      } else assert.notStrictEqual(updated, second);

      const surviving = (await Configured.find({ id: 1 }))[0];
      assert.deepStrictEqual(surviving.toJSON(), { id: 1, name: 'survivor', _rev: 1 });
      if (cache) assert.strictEqual(surviving, survivor);
      else assert.notStrictEqual(surviving, survivor);
      const missingID = ORM.Utils.updateOrNew({ name: 'without-id' }, Type);
      assert.ok(missingID);
      assert.notStrictEqual(missingID, zero);
      assert.strictEqual(missingID.id, undefined);
      assert.deepStrictEqual(zero.toJSON(), cache ? { id: 0, name: 'updated', _rev: 2 } : { id: 0, name: 'zero', _rev: 1 });
    });

    it(`preserves modelJSONSave raw JSON success, four arguments, whitelist and callback return, cache=${cache}`, () => {
      const Type = jsonSaveType(cache);
      saveJSONFixture(new Type({ id: 1, name: 'before', discarded: 'before' }));
      Reflect.set(Type.prototype, 'whitelist', ['id', 'name']);
      const input = { id: 1, name: 'after', discarded: 'after' };
      const calls: unknown[][] = [];
      const marker = {};
      const originalBBCallback = ORM.Utils.bbCallback;
      const returned = ORM.Utils.modelJSONSave(input, Type, (...values: unknown[]) => {
        calls.push(values);
        return marker;
      });
      assert.strictEqual(returned, marker);
      assert.deepStrictEqual(calls, [[null, { id: 1, name: 'after' }, undefined, undefined]]);
      assert.notStrictEqual(calls[0][1], input);
      assert.deepStrictEqual(Type.store, [{ id: 1, name: 'after' }]);
      assert.deepStrictEqual(input, { id: 1, name: 'after', discarded: 'after' });
      assert.strictEqual(ORM.Utils.bbCallback, originalBBCallback);
    });

    it(`delivers a real modelJSONSave memory update rejection without a Backbone fallback, cache=${cache}`, () => {
      const Type = jsonSaveType(cache, false);
      const calls: unknown[][] = [];
      const marker = {};
      const returned = ORM.Utils.modelJSONSave({ id: 99, name: 'missing' }, Type, (...values: unknown[]) => {
        calls.push(values);
        return marker;
      });
      assert.strictEqual(returned, marker);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].length, 1);
      assert.ok(calls[0][0] instanceof Error);
      assert.match(calls[0][0].message, /Update cannot create a new model without manual option/);
      assert.deepStrictEqual(Type.store, []);
    });

    it(`lets modelJSONSave customer throws escape once after the real memory update, cache=${cache}`, () => {
      const Type = jsonSaveType(cache);
      saveJSONFixture(new Type({ id: 1, name: 'before' }));
      const failure = new Error('modelJSONSave customer throw');
      let calls = 0;
      assert.throws(
        () =>
          ORM.Utils.modelJSONSave({ id: 1, name: 'after' }, Type, () => {
            calls++;
            throw failure;
          }),
        (error: unknown) => error === failure
      );
      assert.strictEqual(calls, 1);
      assert.deepStrictEqual(Type.store, [{ id: 1, name: 'after' }]);
    });

    it(`lets modelJSONSave error callback throws escape once without changing memory state, cache=${cache}`, () => {
      const Type = jsonSaveType(cache, false);
      const failure = new Error('modelJSONSave error callback throw');
      let calls = 0;
      assert.throws(
        () =>
          ORM.Utils.modelJSONSave({ id: 99 }, Type, (error) => {
            assert.ok(error instanceof Error);
            assert.match(error.message, /Update cannot create a new model without manual option/);
            calls++;
            throw failure;
          }),
        (error: unknown) => error === failure
      );
      assert.strictEqual(calls, 1);
      assert.deepStrictEqual(Type.store, []);
    });
  }

  it('keeps absent and other falsy ID lookups distinct from zero and truthy cache owners', () => {
    const Type = jsonSaveType(true);
    const zero = ORM.Utils.updateOrNew({ id: 0, name: 'zero' }, Type);
    const one = ORM.Utils.updateOrNew({ id: 1, name: 'one' }, Type);
    assert.ok(zero && one);
    for (const id of [undefined, null, false, '', NaN]) {
      const first = ORM.Utils.updateOrNew({ id, name: 'first' }, Type);
      const second = ORM.Utils.updateOrNew({ id, name: 'second' }, Type);
      assert.ok(first && second);
      assert.notStrictEqual(first, zero);
      assert.notStrictEqual(second, zero);
      assert.notStrictEqual(second, first);
    }
    assert.strictEqual(ORM.Utils.updateOrNew({ id: 1, name: 'updated-one' }, Type), one);
    assert.strictEqual(one.get('name'), 'updated-one');
    assert.strictEqual(zero.get('name'), 'zero');
  });

  it('preserves state helpers, callback translation, data identity, and comparison mutation', () => {
    const state: { _orm?: Record<string, unknown> } = {};
    assert.strictEqual(ORM.Utils.set(state, 'value', 0), 0);
    assert.strictEqual(ORM.Utils.orSet(state, 'value', 7), 0);
    assert.strictEqual(ORM.Utils.get(state, 'missing', 'fallback'), 'fallback');
    assert.strictEqual(ORM.Utils.unset(state, 'value'), true);

    const callbackArguments: unknown[][] = [];
    const options = ORM.Utils.bbCallback((...arguments_: unknown[]) => callbackArguments.push(arguments_)) as {
      error(model: unknown, response: unknown, options: unknown): unknown;
      success(model: unknown, response: unknown, options: unknown): unknown;
    };
    options.success('model', 'response', 'options');
    options.error('model', null, 'options');
    assert.strictEqual(callbackArguments[0][0], null);
    assert.ok(callbackArguments[1][0] instanceof Error);
    const lifecycleError = new Error('Backbone lifecycle error');
    options.error('model', lifecycleError, 'options');
    assert.deepStrictEqual(callbackArguments[2], [lifecycleError, 'model', lifecycleError, 'options']);

    for (const input of [undefined, null]) {
      let originalOptions: unknown;
      const wrapped = ORM.Utils.wrapOptions(input, (_error, _model, _response, callbackOptions) => {
        originalOptions = callbackOptions;
      }) as { success(model: unknown, response: unknown, options: unknown): unknown };
      wrapped.success('model', 'response', { ignored: true });
      assert.deepStrictEqual(originalOptions, {});
    }

    const explicitOptions = { marker: true };
    let observedExplicitOptions: unknown;
    const explicitWrapped = ORM.Utils.wrapOptions(explicitOptions, (_error, _model, _response, callbackOptions) => {
      observedExplicitOptions = callbackOptions;
    }) as { success(model: unknown, response: unknown, options: unknown): unknown };
    explicitWrapped.success('model', 'response', { ignored: true });
    assert.strictEqual(observedExplicitOptions, explicitOptions);

    let callbackOptions: unknown;
    const callbackInputArguments: unknown[][] = [];
    const callbackInput = (...arguments_: unknown[]) => callbackInputArguments.push(arguments_);
    const callbackWrapped = ORM.Utils.wrapOptions(callbackInput, (_error, _model, _response, observedOptions) => {
      callbackOptions = observedOptions;
    }) as { success(model: unknown, response: unknown, options: unknown): unknown };
    callbackWrapped.success('model', 'response', { ignored: true });
    assert.notStrictEqual(callbackOptions, callbackInput);
    (callbackOptions as { success(model: unknown, response: unknown, options: unknown): unknown }).success('nested-model', 'nested-response', 'nested-options');
    assert.deepStrictEqual(callbackInputArguments, [[null, 'nested-model', 'nested-response', 'nested-options']]);

    const left = new Backbone.Model({ first: 1, second: 2 });
    const right = new Backbone.Model({ first: 1, second: 3 });
    const fields: unknown[] = ['first', 'second'];
    assert.strictEqual(ORM.Utils.fieldCompare(left, right, fields), -1);
    assert.deepStrictEqual(fields, ['first']);
    assert.strictEqual(ORM.Utils.dataIsSameModel({ id: 4 }, 4), true);
    assert.strictEqual(ORM.Utils.isModel(null), null);
    assert.strictEqual(ORM.Utils.isCollection(0), 0);
  });
});
