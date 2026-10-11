import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

export type Row = Record<string, unknown>;
export type Callback = (error?: Error | null) => unknown;
export interface IntegrityType {
  new (attributes?: Row): Backbone.Model;
  prototype: Backbone.Model;
  cache?: { get(id: unknown): Backbone.Model | undefined; set(id: unknown, model: Backbone.Model): unknown; destroy(id: unknown): unknown };
  store: Row[];
  schema(): { relations: Record<string, { key: string; foreign_key: string; join_key: string; join_table?: IntegrityType; reverse_relation?: { join_key: string } }> };
}

let sequence = 0;
export function modelType(name: string, schema: () => object, idAttribute = 'id'): IntegrityType {
  const Type = Backbone.Model.extend({ model_name: `DeletionIntegrity${name}${sequence++}`, schema, idAttribute }) as unknown as IntegrityType;
  Type.prototype.sync = ORM.sync(Type);
  return Type;
}

export function family(cache: boolean, customId = false): { Parent: IntegrityType; Child: IntegrityType; foreignKey: string } {
  ORM.configure({ model_cache: { enabled: cache, max: 100 } });
  let Child: IntegrityType;
  const Parent = modelType('Parent', () => ({ id: ['Integer', { manual: true }], children: () => ['hasMany', Child, { as: 'parent' }] }), customId ? '_id' : 'id');
  Child = modelType('Child', () => ({ parent: () => ['belongsTo', Parent, { as: 'children' }] }));
  return { Parent, Child, foreignKey: Child.schema().relations.parent.foreign_key };
}

export function save(model: Backbone.Model): void {
  let completed = false;
  Reflect.apply(model.save, model, [(error: Error) => { assert.ifError(error); completed = true; }]);
  assert.ok(completed, 'Real memory save must complete');
}

export function destroy(model: Backbone.Model, callback: Callback, options?: object): unknown {
  return Reflect.apply(model.destroy, model, options ? [options, callback] : [callback]);
}

export function dispatch(Type: IntegrityType, method: string, ...arguments_: unknown[]): unknown {
  return Reflect.apply(Type.prototype.sync, undefined, [method, ...arguments_]);
}

export function memoryWorker(Type: IntegrityType): { store: Row[] } {
  const exposed = dispatch(Type, 'sync') as object;
  const wrapped = Reflect.get(exposed, 'wrapped_sync_fn');
  return (typeof wrapped === 'function' ? Reflect.apply(wrapped, exposed, ['sync']) : exposed) as { store: Row[] };
}

// The callback boundary is suspended; resumption invokes the original real memory update.
export function suspendUpdate(Type: IntegrityType): () => unknown {
  const original = Type.prototype.sync;
  let pending: (() => unknown) | undefined;
  Reflect.set(Type.prototype, 'sync', function suspended(this: unknown, method: string, model: Backbone.Model, options: object): unknown {
    if (method === 'update') { pending = () => Reflect.apply(original, this, [method, model, options]); return; }
    return Reflect.apply(original, this, [method, model, options]);
  });
  return () => {
    assert.ok(pending, 'Real relation update must reach the suspended callback boundary');
    Type.prototype.sync = original;
    return pending();
  };
}

// This is an intentional failing callback input, not a database provider substitute.
export function rejectUpdate(Type: IntegrityType, failure: Error, shouldFail: (model: Backbone.Model) => boolean = () => true): void {
  const original = Type.prototype.sync;
  Reflect.set(Type.prototype, 'sync', function rejected(this: unknown, method: string, model: Backbone.Model, options: { error(error: Error): unknown }): unknown {
    if (method === 'update' && shouldFail(model)) return options.error(failure);
    return Reflect.apply(original, this, [method, model, options]);
  });
}
