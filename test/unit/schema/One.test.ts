import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';
import { destroy, family, type IntegrityType, modelType, save } from '../../lib/deletionIntegrityModels.ts';
import { observePublishedRelationOperations, observePublishedSchemaRelationContract } from '../../lib/publicContractObservations.ts';

function oneSaveFamily(cache: boolean, exclusion?: 'embed' | 'virtual') {
  ORM.configure({ model_cache: { enabled: cache, max: 100 } });
  let Profile: IntegrityType;
  const Owner = modelType('OneSaveOwner', () => ({
    name: 'String',
    profile: () => ['hasOne', Profile, { as: 'owner', embed: exclusion === 'embed', virtual: exclusion === 'virtual' }],
  }));
  Profile = modelType('OneSaveProfile', () => ({ title: 'String', owner: () => ['belongsTo', Owner, { as: 'profile' }] }));
  const relation = Owner.schema().relations.profile;
  const foreignKey = Profile.schema().relations.owner.foreign_key;
  const relationSave = (owner: Backbone.Model): void => {
    const operation: unknown = Reflect.get(relation, 'save');
    assert.ok(typeof operation === 'function');
    let calls = 0;
    Reflect.apply(operation, relation, [
      owner,
      (error?: Error | null) => {
        calls += 1;
        assert.ifError(error);
      },
    ]);
    assert.strictEqual(calls, 1);
  };
  return { Owner, Profile, foreignKey, relationSave };
}

describe('One', () => {
  describe('null save through the real memory relation worker', () => {
    afterEach(() => ORM.configure({ model_cache: { enabled: false } }));

    for (const cache of [false, true]) {
      it(`removes the linked reverse FK without deleting rows, cache=${cache}`, () => {
        const { Owner, Profile, foreignKey, relationSave } = oneSaveFamily(cache);
        const first = new Profile({ title: 'first' });
        const replacement = new Profile({ title: 'replacement' });
        const survivor = new Profile({ title: 'survivor' });
        for (const profile of [first, replacement, survivor]) save(profile);
        const owner = new Owner({ profile: first });
        const other = new Owner({ profile: survivor });
        save(owner);
        save(other);
        owner.set('profile', replacement);
        save(owner);
        assert.strictEqual(Profile.store.find((row) => row.id === replacement.id)?.[foreignKey], owner.id);
        owner.set('profile', null);
        relationSave(owner);
        assert.strictEqual(Profile.store.find((row) => row.id === replacement.id)?.[foreignKey], null);
        assert.strictEqual(Profile.store.find((row) => row.id === first.id)?.[foreignKey], null);
        assert.strictEqual(Profile.store.find((row) => row.id === survivor.id)?.[foreignKey], other.id);
        assert.strictEqual(Profile.store.length, 3);
        assert.strictEqual(Owner.store.length, 2);
        assert.strictEqual(owner.get('profile'), null);
      });

      it(`completes already-null and dirty-unlinked work once, cache=${cache}`, () => {
        const { Owner, Profile, relationSave } = oneSaveFamily(cache);
        const owner = new Owner({ profile: null });
        save(owner);
        relationSave(owner);
        const ownerRows = Owner.store.map((row) => ({ ...row }));
        const profileRows = Profile.store.map((row) => ({ ...row }));
        owner.set('profile', new Profile({ title: 'never persisted' }));
        owner.set('profile', null);
        relationSave(owner);
        relationSave(owner);
        assert.deepStrictEqual(Owner.store, ownerRows);
        assert.deepStrictEqual(Profile.store, profileRows);
      });
    }

    it('leaves belongsTo FK persistence with the owning model save', () => {
      const { Parent, Child, foreignKey } = family(false);
      const parent = new Parent({ id: 1 });
      save(parent);
      const child = new Child({ parent });
      save(child);
      const relation = Child.schema().relations.parent;
      const operation: unknown = Reflect.get(relation, 'save');
      assert.ok(typeof operation === 'function');
      child.set('parent', null);
      let callbacks = 0;
      Reflect.apply(operation, relation, [
        child,
        (error?: Error | null) => {
          callbacks += 1;
          assert.ifError(error);
        },
      ]);
      assert.strictEqual(callbacks, 1);
      assert.strictEqual(Child.store[0][foreignKey], parent.id);
      save(child);
      assert.strictEqual(Child.store[0][foreignKey], null);
    });

    for (const exclusion of ['embed', 'virtual'] as const) {
      it(`does not write reverse rows for a null ${exclusion} relation`, () => {
        const { Owner, Profile, relationSave } = oneSaveFamily(false, exclusion);
        const profile = new Profile({ title: 'independent' });
        save(profile);
        const owner = new Owner({ profile });
        save(owner);
        const before = Profile.store.map((row) => ({ ...row }));
        owner.set('profile', null);
        relationSave(owner);
        assert.deepStrictEqual(Profile.store, before);
        save(owner);
        assert.deepStrictEqual(Profile.store, before);
        if (exclusion === 'embed') assert.strictEqual(Owner.store[0].profile, null);
      });
    }
  });

  it('keeps public patchRemove persistence outside deletion context', () => {
    const { Parent, Child, foreignKey } = family(false);
    const parent = new Parent({ id: 1 });
    save(parent);
    const child = new Child({ parent });
    save(child);
    const captured = Child.store[0];
    let count = 0;
    Reflect.apply(Reflect.get(child, 'patchRemove'), child, [
      (error: Error) => {
        assert.ifError(error);
        count++;
      },
    ]);
    assert.strictEqual(count, 1);
    assert.notStrictEqual(Child.store[0], captured);
    assert.strictEqual(Child.store[0][foreignKey], null);
    assert.strictEqual(Child.store.length, 1);
  });

  for (const cache of [false, true]) {
    it(`rejects deletion with a public patchRemove override before mutation, cache=${cache}`, () => {
      const { Parent, Child } = family(cache);
      const parent = new Parent({ id: 1 });
      save(parent);
      const relation = Child.schema().relations.parent;
      const original = Reflect.get(relation, 'patchRemove') as (...arguments_: unknown[]) => unknown;
      let calls = 0;
      Reflect.set(relation, 'patchRemove', function overridden(this: unknown, ...arguments_: unknown[]): unknown {
        calls++;
        return Reflect.apply(original, this, arguments_);
      });
      const first = new Child({ parent });
      save(first);
      Reflect.apply(Reflect.get(first, 'patchRemove'), first, [(error: Error) => assert.ifError(error)]);
      assert.strictEqual(calls, 1);
      const second = new Child({ parent });
      save(second);
      const captured = Child.store.slice();
      let destroys = 0;
      let errors = 0;
      second.on('destroy', () => destroys++);
      second.on('error', () => errors++);
      let completed = 0;
      destroy(second, (error) => {
        assert.match(error?.message ?? '', /Unsupported relation\.patchRemove override/);
        completed++;
      });
      assert.strictEqual(completed, 1);
      assert.strictEqual(destroys, 0);
      assert.strictEqual(errors, 1);
      assert.strictEqual(calls, 1);
      assert.deepStrictEqual(Child.store, captured);
      assert.strictEqual(second.get('parent'), parent);
      if (cache) assert.strictEqual(Child.cache?.get(second.id), second);
    });
  }
  it('owns loaded and unloaded ID, JSON, and model patch inputs', async () => {
    const inputs = (await observePublishedRelationOperations(ORM, Backbone)).onePatchInputs as Record<string, Record<string, unknown>>;
    for (const key of ['loaded-id', 'loaded-json', 'loaded-model', 'unloaded-id', 'unloaded-json', 'unloaded-model']) {
      assert.deepStrictEqual(inputs[key].addCallback, {
        argumentCount: 1,
        error: null,
        receiverIsUndefined: false,
        returned: null,
      });
      assert.strictEqual((inputs[key].afterRemove as Record<string, unknown>).profile, null);
      assert.strictEqual((inputs[key].afterRemove as Record<string, unknown>).storedOwnerId, null);
    }
    assert.strictEqual(inputs.arrayError.error, 'One.patchAdd: should be provided with one model only for key: profile');
    assert.strictEqual(inputs.missingError.error, "patchAdd: missing relateds for 'profile'");
  });

  it('preserves release and backlink lifecycle behavior', async () => {
    const lifecycle = (await observePublishedRelationOperations(ORM, Backbone)).collectionLifecycle as Record<string, unknown>;
    assert.deepStrictEqual(lifecycle.afterOneRelease, {
      oldBacklinkRetained: true,
      ormMissing: false,
      profileAfterRelease: 2,
      replacementBacklinkInstalled: false,
    });
  });

  it('preserves remove-all returns and rejects plain-JSON remove-some', async () => {
    const boundaries = (await observePublishedSchemaRelationContract(ORM, Backbone)).translationBoundaries as Record<string, unknown>;
    assert.deepStrictEqual(boundaries.oneRemoveAll, {
      callbackCount: 1,
      callbackErrorIsOriginal: true,
      callbackReceiverIsUndefined: true,
      returnedUndefined: true,
    });
    assert.deepStrictEqual(boundaries.onePlainJSONRemoveSome, {
      callbackCount: 0,
      errorName: 'TypeError',
      threw: true,
    });
  });
});
