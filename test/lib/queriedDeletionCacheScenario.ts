import assert from 'assert';
import type Backbone from 'backbone';
import type { BackboneORMRuntime } from 'backbone-orm';
import type { IntegrityType } from './deletionIntegrityModels.ts';

let sequence = 0;

export default async function queriedDeletionCacheScenario(runtime: BackboneORMRuntime, replaceCache: boolean): Promise<void> {
  runtime.configure({ model_cache: { enabled: true, max: 5000 } });
  let Child: IntegrityType;
  const Parent = runtime.Backbone.Model.extend({ model_name: `QueriedDeletionParent${sequence++}`, schema() { return { id: ['Integer', { manual: true }], children: () => ['hasMany', Child, { as: 'parent' }] }; } }) as unknown as IntegrityType;
  Child = runtime.Backbone.Model.extend({ model_name: `QueriedDeletionChild${sequence++}`, schema() { return { parent: () => ['belongsTo', Parent, { as: 'children' }] }; } }) as unknown as IntegrityType;
  runtime.configureModel(Parent);
  runtime.configureModel(Child);
  const save = (model: Backbone.Model): void => {
    let count = 0;
    Reflect.apply(model.save, model, [(error: Error) => { assert.ifError(error); count++; }]);
    assert.strictEqual(count, 1);
  };
  const first = new Parent({ id: 1, group: 'remove' });
  save(first);
  save(new Child({ parent: first }));
  for (let id = 2; id <= 2001; id++) save(new Parent({ id, group: 'remove' }));

  const original = Child.prototype.sync;
  const resumptions = new Map<unknown, () => unknown>();
  let reachedFirst: () => void = () => { throw new Error('First cleanup listener is not installed'); };
  const firstCleanup = new Promise<void>((resolve) => { reachedFirst = resolve; });
  let reachedLater: () => void = () => { throw new Error('Later cleanup listener is not installed'); };
  const laterCleanup = new Promise<void>((resolve) => { reachedLater = resolve; });
  Reflect.set(Child.prototype, 'sync', function suspended(this: unknown, method: string, model: Backbone.Model, options: object): unknown {
    if (method === 'update') {
      resumptions.set(model.id, () => Reflect.apply(original, this, [method, model, options]));
      if (model.id === 1) reachedFirst();
      if (model.id === 2) reachedLater();
      return;
    }
    return Reflect.apply(original, this, [method, model, options]);
  });
  try {
    let callbackCount = 0;
    const completed = new Promise<void>((resolve, reject) => {
      Reflect.apply(Parent.prototype.sync, undefined, ['destroy', { group: 'remove' }, (error: Error) => {
        callbackCount++;
        if (error) reject(error);
        else resolve();
      }]);
    });
    await Promise.race([firstCleanup, completed.then(() => { throw new Error('Queried deletion completed without reaching first cleanup'); })]);
    assert.ok(resumptions.has(1), 'First real relation update must suspend');
    const later = new Parent({ id: 2002, group: 'remove' });
    save(later);
    save(new Child({ parent: later }));
    assert.strictEqual(Parent.cache?.get(2002), later);
    resumptions.get(1)?.();
    await Promise.race([laterCleanup, completed.then(() => { throw new Error('Queried deletion completed without reaching later cleanup'); })]);
    assert.ok(Parent.store.some((row) => row.id === 2002));
    assert.strictEqual(Parent.cache?.get(2002), later);
    const replacement = new Parent({ id: 2002, name: 'later-cache-owner' });
    if (replaceCache) Parent.cache?.set(2002, replacement);
    resumptions.get(2)?.();
    await completed;
    assert.strictEqual(callbackCount, 1);
    assert.deepStrictEqual(Parent.store, []);
    assert.strictEqual(Parent.cache?.get(1), undefined);
    assert.strictEqual(Parent.cache?.get(2002), replaceCache ? replacement : undefined);
  } finally {
    Child.prototype.sync = original;
    runtime.configure({ model_cache: { enabled: false } });
  }
}
