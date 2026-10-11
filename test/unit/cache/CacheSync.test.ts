import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';
import { destroy, dispatch, family, modelType, save, suspendUpdate } from '../../lib/deletionIntegrityModels.ts';
import { observePublishedCursorContract } from '../../lib/publicContractObservations.ts';
import queriedDeletionCacheScenario from '../../lib/queriedDeletionCacheScenario.ts';

describe('CacheSync', () => {
  const readCandidate = () => observePublishedCursorContract(ORM, Backbone);

  it('preserves cache read, force, update, delete, and reset behavior', async () => {
    assert.deepStrictEqual((await readCandidate()).cache, {
      cachedIdentity: true,
      connectClearedCache: true,
      deleteClearedCache: true,
      forcedReadName: 'stored',
      ordinaryReadName: 'cached',
      resetClearedBoth: true,
      updatedName: 'updated',
      updateKeptIdentity: true,
    });
  });

  it('uses the owned memory snapshot instead of the retained changing-store batch policy', async () => {
    const policy = (await readCandidate()).cachePolicy as Record<string, unknown>;
    assert.strictEqual(policy.destroyQuery, undefined);
  });

  it('inherits the static parser on cache cursors', async () => {
    const policy = (await readCandidate()).cachePolicy as Record<string, unknown>;
    assert.strictEqual(policy.cacheCursorParseQuery, 'function');
  });

  it('does not make connect depend on a reset callback', async () => {
    const policy = (await readCandidate()).cachePolicy as Record<string, unknown>;
    assert.deepStrictEqual(policy.connectOrder, ['reset', 'connect']);
  });

  it('preserves create and update error callback ownership', async () => {
    assert.deepStrictEqual((await readCandidate()).cacheErrors, {
      create: {
        argumentMessages: ['Create should not be called for a manual id. Set an id before calling save. Model name: CursorContractManualErrorModel. Model: {"name":"missing-id"}'],
        omittedHandlerReturnIsUndefined: true,
        receiverIsOptions: true,
        returned: 'create-error-return',
      },
      update: {
        argumentMessages: ['Update cannot create a new model without manual option. Set an id before calling save. Model name: CursorContractAutomaticErrorModel. Model: {"id":404,"name":"missing"}'],
        omittedHandlerReturnIsUndefined: true,
        receiverIsOptions: true,
        returned: 'update-error-return',
      },
    });
  });

  it('does not evict a replacement cache entry after suspended wrapped deletion succeeds', () => {
    const { Parent, Child } = family(true);
    const parent = new Parent({ id: 1 });
    save(parent);
    save(new Child({ parent }));
    const resume = suspendUpdate(Child);
    let count = 0;
    destroy(parent, (error) => {
      assert.ifError(error);
      count++;
    });
    assert.strictEqual(Parent.cache?.get(1), parent);
    const replacement = new Parent({ id: 1, name: 'new-cache-owner' });
    Parent.cache?.set(1, replacement);
    resume();
    assert.strictEqual(count, 1);
    assert.deepStrictEqual(Parent.store, []);
    assert.strictEqual(Parent.cache?.get(1), replacement);
  });

  it('rechecks the actual wrapped sync before treating a cache wrapper as owned memory', () => {
    const { Parent } = family(true);
    const parent = new Parent({ id: 1 });
    save(parent);
    const wrapper = dispatch(Parent, 'sync') as { wrapped_sync_fn(method: string, ...arguments_: unknown[]): unknown };
    const original = wrapper.wrapped_sync_fn;
    const evictionChecks: boolean[] = [];
    wrapper.wrapped_sync_fn = function delegated(method, ...arguments_) {
      if (method === 'delete') evictionChecks.push(Parent.cache?.get(1) === undefined);
      return Reflect.apply(original, this, [method, ...arguments_]);
    };
    let count = 0;
    destroy(parent, (error) => {
      assert.ifError(error);
      count++;
    });
    assert.strictEqual(count, 1);
    assert.deepStrictEqual(evictionChecks, [true]);
    assert.deepStrictEqual(Parent.store, []);
  });

  for (const replaceCache of [false, true]) {
    it(`captures later queried-batch cache owners before cleanup, replacement=${replaceCache}`, async () => {
      await queriedDeletionCacheScenario(ORM, replaceCache);
    });
  }

  describe('returned update attributes', () => {
    afterEach(() => ORM.configure({ model_cache: { enabled: false } }));

    for (const [responseMode, cachedOwner, attributeData, legacyVeto] of [
      ['full', true, false, false],
      ['partial', true, false, false],
      ['null', true, false, false],
      ['undefined', true, false, false],
      ['full', false, false, false],
      ['full', true, true, false],
      ['partial', true, true, false],
      ['full', true, true, true],
      ['partial', true, true, true],
    ] as const) {
      it(`consumes only the owned JSON postimage and keeps attribute/control namespaces separate, response=${responseMode}, cached-owner=${cachedOwner}, attribute-data=${attributeData}, legacy-veto=${legacyVeto}`, () => {
        ORM.configure({ model_cache: { enabled: true, max: 100 } });
        const Type = modelType('CachePostimage', () => ({ id: ['Integer', { manual: true }] }));
        const before = { id: 1, name: 'before', retained: 'before', ...(attributeData ? { _orm_needs_load: 'before-data' } : {}) };
        const stored = { id: 1, name: 'persisted', retained: 'next', ...(attributeData ? { _orm_needs_load: 'persisted-data' } : {}) };
        const canonical = new Type(before);
        save(canonical);
        assert.ok(Type.cache);
        const isLoaded = Reflect.get(canonical, 'isLoaded');
        const setLoaded = Reflect.get(canonical, 'setLoaded');
        assert.strictEqual(typeof isLoaded, 'function');
        assert.strictEqual(typeof setLoaded, 'function');
        if (legacyVeto) Reflect.apply(setLoaded, canonical, [false]);
        const beforeLoaded = Reflect.apply(isLoaded, canonical, []);
        const loadingState = ORM.Utils.get(canonical, 'needs_load');
        assert.ok(typeof loadingState === 'object' && loadingState !== null);
        const beforeLoading = { ...loadingState };
        const events: string[] = [];
        canonical.on('all', (event: string) => events.push(event));
        if (!cachedOwner) Type.cache.destroy(1);
        const owner = dispatch(Type, 'sync');
        assert.ok(typeof owner === 'object' && owner !== null);
        const original = Reflect.get(owner, 'wrapped_sync_fn');
        assert.strictEqual(typeof original, 'function');
        let temporary: Backbone.Model | undefined;
        let originalToJSON: Backbone.Model['toJSON'] | undefined;
        let originalClone: Backbone.Model['clone'] | undefined;
        let serializations = 0;
        let clones = 0;
        let forwarded: unknown;
        let calls = 0;
        const marker = {};
        Reflect.set(owner, 'wrapped_sync_fn', function observed(this: unknown, method: string, ...arguments_: unknown[]): unknown {
          if (method !== 'update') return Reflect.apply(original, this, [method, ...arguments_]);
          const [model, options] = arguments_;
          assert.ok(model instanceof Backbone.Model);
          assert.ok(typeof options === 'object' && options !== null);
          const success = Reflect.get(options, 'success');
          assert.strictEqual(typeof success, 'function');
          temporary = model;
          const JSONModel = ORM.Utils.get(Type, 'model_type_json');
          assert.strictEqual(typeof JSONModel, 'function');
          assert.strictEqual(model.constructor, JSONModel);
          assert.strictEqual(Reflect.get(model, '_orm_never_cache'), true);
          assert.strictEqual(Reflect.get(model, '_orm_needs_load'), undefined);
          originalToJSON = model.toJSON;
          originalClone = model.clone;
          Reflect.set(model, 'toJSON', function observedJSON(this: Backbone.Model, ...values: unknown[]): unknown {
            serializations++;
            assert.ok(originalToJSON);
            return Reflect.apply(originalToJSON, this, values);
          });
          Reflect.set(model, 'clone', function observedClone(this: Backbone.Model, ...values: unknown[]): unknown {
            clones++;
            assert.ok(originalClone);
            return Reflect.apply(originalClone, this, values);
          });
          return Reflect.apply(original, this, [
            method,
            model,
            {
              ...options,
              success(response: unknown) {
                assert.deepStrictEqual(Type.store, [stored]);
                assert.deepStrictEqual(response, stored);
                assert.ok(typeof response === 'object' && response !== null);
                assert.strictEqual(serializations, 1);
                if (responseMode === 'full' || responseMode === 'partial') model.set('name', 'late-input');
                if (attributeData) model.set('_orm_needs_load', 'late-data');
                if (legacyVeto) Reflect.set(model, '_orm_needs_load', 'legacy-control');
                forwarded = responseMode === 'null' ? null : responseMode === 'undefined' ? undefined : responseMode === 'partial' ? { name: Reflect.get(response, 'name'), ...(attributeData ? { _orm_needs_load: Reflect.get(response, '_orm_needs_load') } : {}) } : response;
                return Reflect.apply(success, options, [forwarded]);
              },
            },
          ]);
        });
        try {
          const returned = ORM.Utils.modelJSONSave(stored, Type, (...values: unknown[]) => {
            calls++;
            assert.strictEqual(values.length, 4);
            assert.strictEqual(values[0], null);
            assert.strictEqual(values[1], forwarded);
            assert.strictEqual(values[2], undefined);
            assert.strictEqual(values[3], undefined);
            assert.deepStrictEqual(Type.store, [stored]);
            if (cachedOwner) {
              assert.strictEqual(Type.cache?.get(1), canonical);
              if (legacyVeto) {
                assert.strictEqual(serializations, 1);
                assert.strictEqual(clones, 0, 'Control veto precedes postimage construction');
                assert.deepStrictEqual(canonical.toJSON(), before);
                assert.strictEqual(Reflect.apply(isLoaded, canonical, []), beforeLoaded);
                assert.strictEqual(ORM.Utils.get(canonical, 'needs_load'), loadingState);
                assert.deepStrictEqual(loadingState, beforeLoading);
                assert.deepStrictEqual(events, []);
              } else {
                assert.deepStrictEqual(canonical.toJSON(), stored);
                assert.strictEqual(Reflect.get(canonical, '_orm_needs_load'), undefined);
              }
            } else assert.strictEqual(Type.cache?.get(1), undefined);
            return marker;
          });
          assert.strictEqual(returned, marker);
          assert.strictEqual(calls, 1);
          assert.ok(temporary);
          assert.notStrictEqual(temporary, canonical);
          assert.strictEqual(temporary.get('name'), responseMode === 'full' || responseMode === 'partial' ? 'late-input' : 'persisted');
          if (attributeData) assert.strictEqual(temporary.get('_orm_needs_load'), 'late-data');
          assert.strictEqual(Reflect.get(temporary, '_orm_needs_load'), legacyVeto ? 'legacy-control' : undefined);
          if (cachedOwner) assert.strictEqual(Type.cache?.get(1), canonical);
          else {
            assert.strictEqual(Type.cache?.get(1), undefined);
            assert.deepStrictEqual(canonical.toJSON(), before);
          }
        } finally {
          try {
            Reflect.set(owner, 'wrapped_sync_fn', original);
          } finally {
            if (temporary && originalToJSON) Reflect.set(temporary, 'toJSON', originalToJSON);
            if (temporary && originalClone) Reflect.set(temporary, 'clone', originalClone);
          }
        }
      });
    }

    for (const responseMode of ['full', 'partial'] as const) {
      for (const legacyVeto of [true, false]) {
        it(`preserves the raw-update legacy source veto separately from loading metadata, response=${responseMode}, legacy-veto=${legacyVeto}`, () => {
          ORM.configure({ model_cache: { enabled: true, max: 100 } });
          const Type = modelType('CachePostimageVeto', () => ({ id: ['Integer', { manual: true }] }));
          const canonical = new Type({ id: 1, name: 'before', retained: 'before' });
          save(canonical);
          assert.ok(Type.cache);
          const setCanonicalLoaded = Reflect.get(canonical, 'setLoaded');
          const isCanonicalLoaded = Reflect.get(canonical, 'isLoaded');
          assert.strictEqual(typeof setCanonicalLoaded, 'function');
          assert.strictEqual(typeof isCanonicalLoaded, 'function');
          Reflect.apply(setCanonicalLoaded, canonical, [false]);
          assert.strictEqual(Reflect.apply(isCanonicalLoaded, canonical, []), false);
          const beforeAttributes = canonical.toJSON();
          const loadingState = ORM.Utils.get(canonical, 'needs_load');
          assert.ok(typeof loadingState === 'object' && loadingState !== null);
          const beforeLoading = { ...loadingState };
          const events: string[] = [];
          canonical.on('all', (event: string) => events.push(event));
          const input = new Type({ id: 1, name: 'persisted', retained: 'next' });
          const isInputLoaded = Reflect.get(input, 'isLoaded');
          const setInputLoaded = Reflect.get(input, 'setLoaded');
          assert.strictEqual(typeof isInputLoaded, 'function');
          assert.strictEqual(typeof setInputLoaded, 'function');
          if (legacyVeto) {
            Reflect.set(input, '_orm_needs_load', 'legacy-veto');
            assert.strictEqual(Reflect.apply(isInputLoaded, input, []), true);
          } else {
            Reflect.apply(setInputLoaded, input, [false]);
            assert.strictEqual(Reflect.get(input, '_orm_needs_load'), undefined);
            assert.strictEqual(Reflect.apply(isInputLoaded, input, []), false);
          }
          assert.strictEqual(Type.cache.get(1), canonical);
          let serializations = 0;
          const originalToJSON = input.toJSON;
          Reflect.set(input, 'toJSON', function observedJSON(this: Backbone.Model, ...arguments_: unknown[]): unknown {
            serializations++;
            return Reflect.apply(originalToJSON, this, arguments_);
          });
          const owner = dispatch(Type, 'sync');
          assert.ok(typeof owner === 'object' && owner !== null);
          const original = Reflect.get(owner, 'wrapped_sync_fn');
          assert.strictEqual(typeof original, 'function');
          let forwarded: unknown;
          let calls = 0;
          const marker = {};
          Reflect.set(owner, 'wrapped_sync_fn', function observed(this: unknown, method: string, ...arguments_: unknown[]): unknown {
            if (method !== 'update') return Reflect.apply(original, this, [method, ...arguments_]);
            const [model, wrappedOptions] = arguments_;
            assert.strictEqual(model, input);
            assert.ok(typeof wrappedOptions === 'object' && wrappedOptions !== null);
            const success = Reflect.get(wrappedOptions, 'success');
            assert.strictEqual(typeof success, 'function');
            return Reflect.apply(original, this, [
              method,
              model,
              {
                ...wrappedOptions,
                success(response: unknown) {
                  assert.deepStrictEqual(Type.store, [{ id: 1, name: 'persisted', retained: 'next' }]);
                  assert.deepStrictEqual(response, Type.store[0]);
                  assert.ok(typeof response === 'object' && response !== null);
                  assert.strictEqual(serializations, 1, 'Real provider serializes before the cache boundary');
                  forwarded = responseMode === 'partial' ? { name: Reflect.get(response, 'name') } : response;
                  return Reflect.apply(success, wrappedOptions, [forwarded]);
                },
              },
            ]);
          });
          try {
            const options = {
              success(this: unknown, response: unknown): unknown {
                calls++;
                assert.strictEqual(this, options);
                assert.strictEqual(response, forwarded);
                assert.deepStrictEqual(Type.store, [{ id: 1, name: 'persisted', retained: 'next' }]);
                assert.strictEqual(Type.cache?.get(1), canonical);
                if (legacyVeto) {
                  assert.strictEqual(serializations, 1, 'Veto precedes cache-side serialization');
                  assert.deepStrictEqual(canonical.toJSON(), beforeAttributes);
                  assert.strictEqual(Reflect.apply(isCanonicalLoaded, canonical, []), false);
                  assert.strictEqual(ORM.Utils.get(canonical, 'needs_load'), loadingState);
                  assert.deepStrictEqual(loadingState, beforeLoading);
                  assert.deepStrictEqual(events, []);
                } else {
                  assert.strictEqual(serializations, 2);
                  assert.deepStrictEqual(canonical.toJSON(), Type.store[0]);
                  assert.strictEqual(Reflect.apply(isCanonicalLoaded, canonical, []), true);
                  assert.ok(events.includes('change'));
                }
                return marker;
              },
              error(error: unknown): never {
                throw error;
              },
            };
            const returned = dispatch(Type, 'update', input, options);
            assert.strictEqual(returned, marker);
            assert.strictEqual(calls, 1);
            assert.strictEqual(Reflect.get(input, '_orm_needs_load'), legacyVeto ? 'legacy-veto' : undefined);
            assert.strictEqual(Reflect.apply(isInputLoaded, input, []), legacyVeto);
          } finally {
            Reflect.set(owner, 'wrapped_sync_fn', original);
            Reflect.set(input, 'toJSON', originalToJSON);
          }
        });
      }
    }

    it('keeps an ordinary distinct cached instance free of envelope attributes before save parses response.record', () => {
      ORM.configure({ model_cache: { enabled: true, max: 100 } });
      const Type = modelType('CachePostimageEnvelope', () => ({ id: ['Integer', { manual: true }] }));
      const canonical = new Type({ id: 1, name: 'before', retained: 'before' });
      save(canonical);
      let registered = 0;
      ORM.Utils.modelJSONSave({ id: 1, name: 'before', retained: 'before' }, Type, (error) => {
        assert.ifError(error);
        registered++;
      });
      assert.strictEqual(registered, 1);
      const JSONModel = ORM.Utils.get(Type, 'model_type_json');
      assert.strictEqual(typeof JSONModel, 'function');
      const input = new Type({ id: 1, name: 'persisted', retained: 'next' });
      assert.notStrictEqual(input.constructor, JSONModel);
      assert.strictEqual(Type.cache?.get(1), canonical);
      const owner = dispatch(Type, 'sync');
      assert.ok(typeof owner === 'object' && owner !== null);
      const original = Reflect.get(owner, 'wrapped_sync_fn');
      assert.strictEqual(typeof original, 'function');
      const originalParse = Type.prototype.parse;
      const order: string[] = [];
      let forwarding = false;
      let envelope: unknown;
      let calls = 0;
      const stored = { id: 1, name: 'persisted', retained: 'next' };
      const copiedInput = { id: 1, name: 'late-input', retained: 'next' };
      canonical.on('change:name', () => order.push('cache-input'));
      input.on('change:name', () => {
        if (forwarding) order.push('change');
      });
      input.on('sync', () => order.push('sync'));
      Reflect.set(Type.prototype, 'parse', (response: unknown) => {
        order.push('parse');
        assert.strictEqual(response, envelope);
        assert.ok(typeof response === 'object' && response !== null);
        const record: unknown = Reflect.get(response, 'record');
        assert.ok(typeof record === 'object' && record !== null);
        assert.deepStrictEqual(Type.store, [stored]);
        assert.strictEqual(Type.cache?.get(1), canonical);
        assert.deepStrictEqual(canonical.toJSON(), copiedInput);
        assert.strictEqual(canonical.get('record'), undefined);
        assert.strictEqual(canonical.get('request_token'), undefined);
        return record;
      });
      Reflect.set(owner, 'wrapped_sync_fn', function observed(this: unknown, method: string, ...arguments_: unknown[]): unknown {
        if (method !== 'update') return Reflect.apply(original, this, [method, ...arguments_]);
        const [model, options] = arguments_;
        assert.strictEqual(model, input);
        assert.ok(typeof options === 'object' && options !== null);
        const success = Reflect.get(options, 'success');
        assert.strictEqual(typeof success, 'function');
        return Reflect.apply(original, this, [
          method,
          model,
          {
            ...options,
            success(response: unknown) {
              assert.deepStrictEqual(Type.store, [stored]);
              assert.deepStrictEqual(response, stored);
              input.set('name', 'late-input');
              envelope = { record: response, request_token: 'response-only' };
              forwarding = true;
              return Reflect.apply(success, options, [envelope]);
            },
          },
        ]);
      });
      try {
        input.save(null, {
          success(model, response) {
            calls++;
            order.push('success');
            assert.strictEqual(model, input);
            assert.strictEqual(response, envelope);
            assert.deepStrictEqual(input.toJSON(), stored);
            assert.strictEqual(Type.cache?.get(1), input);
            assert.deepStrictEqual(canonical.toJSON(), copiedInput);
            assert.deepStrictEqual(Type.store, [stored]);
          },
          error(_model, error: unknown) {
            throw error;
          },
        });
        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(order, ['cache-input', 'parse', 'change', 'success', 'sync']);
        assert.deepStrictEqual(input.toJSON(), stored);
        assert.deepStrictEqual(canonical.toJSON(), copiedInput);
      } finally {
        try {
          Reflect.set(owner, 'wrapped_sync_fn', original);
        } finally {
          Reflect.set(Type.prototype, 'parse', originalParse);
        }
      }
    });

    it('does not admit an ordinary never-cache input as the owned JSON constructor', () => {
      ORM.configure({ model_cache: { enabled: true, max: 100 } });
      const Type = modelType('CachePostimageNeverFlag', () => ({ id: ['Integer', { manual: true }] }));
      const canonical = new Type({ id: 1, name: 'before' });
      save(canonical);
      let registered = 0;
      ORM.Utils.modelJSONSave({ id: 1, name: 'before' }, Type, (error) => {
        assert.ifError(error);
        registered++;
      });
      assert.strictEqual(registered, 1);
      const JSONModel = ORM.Utils.get(Type, 'model_type_json');
      assert.strictEqual(typeof JSONModel, 'function');
      const input = new Type({ id: 1, name: 'persisted' });
      Reflect.set(input, '_orm_never_cache', true);
      assert.notStrictEqual(input.constructor, JSONModel);
      assert.strictEqual(Type.cache?.get(1), canonical);
      const owner = dispatch(Type, 'sync');
      assert.ok(typeof owner === 'object' && owner !== null);
      const original = Reflect.get(owner, 'wrapped_sync_fn');
      assert.strictEqual(typeof original, 'function');
      let forwarded: unknown;
      let calls = 0;
      const marker = {};
      Reflect.set(owner, 'wrapped_sync_fn', function observed(this: unknown, method: string, ...arguments_: unknown[]): unknown {
        if (method !== 'update') return Reflect.apply(original, this, [method, ...arguments_]);
        const [model, options] = arguments_;
        assert.strictEqual(model, input);
        assert.ok(typeof options === 'object' && options !== null);
        const success = Reflect.get(options, 'success');
        assert.strictEqual(typeof success, 'function');
        return Reflect.apply(original, this, [
          method,
          model,
          {
            ...options,
            success(response: unknown) {
              assert.deepStrictEqual(Type.store, [{ id: 1, name: 'persisted' }]);
              assert.deepStrictEqual(response, Type.store[0]);
              input.set('name', 'late-input');
              forwarded = response;
              return Reflect.apply(success, options, [response]);
            },
          },
        ]);
      });
      try {
        const returned = dispatch(Type, 'update', input, {
          success(response: unknown): unknown {
            calls++;
            assert.strictEqual(response, forwarded);
            assert.deepStrictEqual(Type.store, [{ id: 1, name: 'persisted' }]);
            assert.strictEqual(Type.cache?.get(1), canonical);
            assert.deepStrictEqual(canonical.toJSON(), { id: 1, name: 'late-input' });
            return marker;
          },
          error(error: unknown): never {
            throw error;
          },
        });
        assert.strictEqual(returned, marker);
        assert.strictEqual(calls, 1);
      } finally {
        Reflect.set(owner, 'wrapped_sync_fn', original);
      }
    });

    for (const cachedOwner of [false, true]) {
      it(`preserves ordinary save parse/change/success/sync ordering, cached-owner=${cachedOwner}`, () => {
        ORM.configure({ model_cache: { enabled: true, max: 100 } });
        const Type = modelType('CachePostimageSave', () => ({ id: ['Integer', { manual: true }] }));
        const canonical = new Type({ id: 1, name: 'before' });
        save(canonical);
        assert.ok(Type.cache);
        if (!cachedOwner) Type.cache.destroy(1);
        const order: string[] = [];
        Reflect.set(Type.prototype, 'parse', (response: unknown) => {
          assert.ok(typeof response === 'object' && response !== null);
          const name: unknown = Reflect.get(response, 'name');
          assert.strictEqual(typeof name, 'string');
          order.push('parse');
          return { ...response, parsed_name: String(name).toUpperCase() };
        });
        canonical.on('change:parsed_name', () => order.push('change'));
        canonical.on('sync', () => order.push('sync'));
        canonical.set('name', 'updated');
        let calls = 0;
        canonical.save(null, {
          success(model, response) {
            calls++;
            order.push('success');
            assert.strictEqual(model, canonical);
            assert.deepStrictEqual(response, { id: 1, name: 'updated' });
            assert.strictEqual(canonical.get('parsed_name'), 'UPDATED');
            assert.strictEqual(Type.cache?.get(1), canonical);
          },
          error(_model, error: unknown) {
            throw error;
          },
        });
        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(order, ['parse', 'change', 'success', 'sync']);
        assert.deepStrictEqual(Type.store, [{ id: 1, name: 'updated' }]);
        assert.strictEqual(Type.cache?.get(1), canonical);
      });
    }

    for (const replace of [false, true]) {
      it(`preserves canonical children and follow-up saves through hasMany removal/replacement, replace=${replace}`, () => {
        const { Parent, Child, foreignKey } = family(true);
        const parent = new Parent({ id: 1, name: 'parent' });
        const other = new Parent({ id: 2, name: 'other' });
        save(parent);
        save(other);
        const child = new Child({ name: 'linked', parent });
        const survivor = new Child({ name: 'survivor', parent: other });
        save(child);
        save(survivor);
        const survivorRow = Child.store.find((row) => row.id === survivor.id);
        const otherRow = Parent.store.find((row) => row.id === other.id);
        assert.ok(survivorRow && otherRow);
        const survivorBefore = { ...survivorRow };
        const otherBefore = { ...otherRow };
        const replacement = replace ? new Child({ name: 'replacement' }) : undefined;
        if (replacement) save(replacement);
        parent.set('children', replacement ? [replacement] : []);
        save(parent);
        const detached = Child.store.find((row) => row.id === child.id);
        assert.ok(detached);
        assert.strictEqual(detached[foreignKey], null);
        assert.strictEqual(detached.name, 'linked');
        assert.strictEqual(Child.cache?.get(child.id), child);
        assert.strictEqual(child.get('parent'), null);
        child.set('name', 'resaved detached');
        save(child);
        const afterFollowUp = Child.store.find((row) => row.id === child.id);
        assert.ok(afterFollowUp);
        assert.strictEqual(afterFollowUp[foreignKey], null);
        assert.strictEqual(afterFollowUp.name, 'resaved detached');
        assert.strictEqual(Child.cache?.get(child.id), child);
        assert.deepStrictEqual(
          Child.store.find((row) => row.id === survivor.id),
          survivorBefore
        );
        assert.deepStrictEqual(
          Parent.store.find((row) => row.id === other.id),
          otherBefore
        );
        assert.strictEqual(Parent.store.length, 2);
        assert.strictEqual(Child.store.length, replace ? 3 : 2);
        if (replacement) {
          const linked = Child.store.find((row) => row.id === replacement.id);
          assert.ok(linked);
          assert.strictEqual(linked[foreignKey], parent.id);
          assert.strictEqual(Child.cache?.get(replacement.id), replacement);
        }
      });
    }
  });
});
