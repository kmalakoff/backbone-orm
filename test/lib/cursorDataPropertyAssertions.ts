import assert from 'assert';
import type { BackboneORMRuntime, CursorModelConstructor } from 'backbone-orm';

function fields(nullPrototype: boolean, prototypeValue: unknown): Record<string, unknown> {
  const value = Object.fromEntries([
    ['__proto__', prototypeValue], ['constructor', 'constructor-data'], ['prototype', 'prototype-data'],
    ['toString', 'string-data'], ['id', 7], ['name', 'sample'],
    ['nested', Object.freeze(Object.fromEntries([['__proto__', 'nested-data']]))],
  ]);
  if (nullPrototype) Object.setPrototypeOf(value, null);
  return Object.freeze(value);
}

function assertFields(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  assert.deepStrictEqual(Object.keys(actual), Object.keys(expected));
  for (const [key, value] of Object.entries(expected)) {
    assert.deepStrictEqual(Object.getOwnPropertyDescriptor(actual, key), { value, enumerable: true, writable: true, configurable: true });
    assert.strictEqual(Object.getOwnPropertyDescriptor(actual, key)?.value, value);
  }
}

export default function cursorDataPropertyAssertions(getRuntime: () => BackboneORMRuntime, prefix: string): void {
  function model(): CursorModelConstructor {
    const Model: CursorModelConstructor = getRuntime().Backbone.Model.extend({ model_name: prefix });
    return Model;
  }

  it('partitions own prototype-named flat fields without changing target or caller prototypes', () => {
    const runtime = getRuntime();
    const Model = model();
    for (const nullPrototype of [false, true]) {
      for (const prototypeValue of [1, Object.freeze({ tag: 'prototype-data' })]) {
        const find = fields(nullPrototype, prototypeValue);
        const controls = { $sort: Object.freeze(['name']), $limit: 1, $select: Object.freeze(['name']) };
        const query = { ...find, ...controls };
        if (nullPrototype) Object.setPrototypeOf(query, null);
        Object.freeze(query);
        const before = Object.getOwnPropertyDescriptors(query);
        const parsed = runtime.Cursor.parseQuery(query, Model);
        assert.strictEqual(Object.getPrototypeOf(parsed.find), Object.prototype);
        assert.strictEqual(Object.getPrototypeOf(parsed.cursor), Object.prototype);
        assertFields(parsed.find, find);
        assertFields(parsed.cursor, controls);
        assert.notStrictEqual(parsed.find, query);
        assert.strictEqual(Object.getPrototypeOf(query), nullPrototype ? null : Object.prototype);
        assert.deepStrictEqual(Object.getOwnPropertyDescriptors(query), before);
      }
    }
  });

  it('retains explicit section references, descriptors and prototypes', () => {
    const runtime = getRuntime();
    const Model = model();
    for (const nullPrototype of [false, true]) {
      const find = fields(nullPrototype, Object.freeze({ tag: 'literal' }));
      const cursor = Object.freeze({ $sort: Object.freeze(['name']), $select: Object.freeze(['name']) });
      const query = Object.freeze({ find, cursor });
      const before = Object.getOwnPropertyDescriptors(find);
      const parsed = runtime.Cursor.parseQuery(query, Model);
      const constructed = new runtime.Cursor(query, { model_type: Model });
      for (const pair of [parsed, { find: constructed._find, cursor: constructed._cursor }]) {
        assert.strictEqual(pair.find, find);
        assert.strictEqual(pair.cursor, cursor);
        assert.strictEqual(Object.getPrototypeOf(pair.find), nullPrototype ? null : Object.prototype);
        assert.strictEqual(Object.getPrototypeOf(pair.cursor), Object.prototype);
      }
      assert.deepStrictEqual(Object.getOwnPropertyDescriptors(find), before);
      assert.strictEqual(Object.getOwnPropertyDescriptor(find, '__proto__')?.value, find.__proto__);
    }
  });

  it('preserves own flat fields through base and inherited concrete construction', () => {
    const runtime = getRuntime();
    const Model = model();
    const query = fields(true, 1);
    const base = new runtime.Cursor(query, { model_type: Model });
    const concrete = new runtime.sync.Cursor(query, { model_type: Model, store: [] });
    assert.ok(base instanceof runtime.Cursor);
    assert.ok(concrete instanceof runtime.Cursor);
    assert.ok(concrete instanceof runtime.sync.Cursor);
    for (const cursor of [base, concrete]) {
      assertFields(cursor._find, query);
      assert.strictEqual(Object.getPrototypeOf(cursor._find), Object.prototype);
      assert.strictEqual(Object.getPrototypeOf(cursor._cursor), Object.prototype);
    }
    const inheritedParser: unknown = Reflect.get(runtime.sync.Cursor, 'parseQuery');
    assert.strictEqual(inheritedParser, runtime.Cursor.parseQuery);
    assert.ok(typeof inheritedParser === 'function');
    assert.deepStrictEqual(Reflect.apply(inheritedParser, runtime.sync.Cursor, [query, Model]), { find: { ...query }, cursor: {} });
    assert.strictEqual(Object.getPrototypeOf(query), null);
  });

  it('retains flat and explicit own fields in real cache cursor admission', () => {
    const runtime = getRuntime();
    try {
      runtime.configure({ model_cache: { enabled: true, max: 10 } });
      const Model = runtime.configureModel(model());
      const cacheOwner: unknown = Reflect.apply(Model.prototype.sync, Model.prototype, ['sync']);
      assert.ok(cacheOwner && typeof cacheOwner === 'object');
      assert.strictEqual(Reflect.get(cacheOwner, 'model_type'), Model);
      assert.strictEqual(typeof Reflect.get(cacheOwner, 'wrapped_sync_fn'), 'function');
      const find = fields(true, 1);
      const flat = Model.cursor(find);
      assertFields(flat._find, find);
      assert.strictEqual(Object.getPrototypeOf(flat._find), Object.prototype);
      const cursor = Object.freeze({ $select: Object.freeze(['name']) });
      const explicit = Model.cursor(Object.freeze({ find, cursor }));
      assert.strictEqual(explicit._find, find);
      assert.strictEqual(explicit._cursor, cursor);
      assert.strictEqual(Object.getPrototypeOf(explicit._find), null);
      assert.strictEqual(Object.getOwnPropertyDescriptor(explicit._find, '__proto__')?.value, 1);
      assert.strictEqual(Object.getPrototypeOf(find), null);
    } finally {
      runtime.configure({ model_cache: { enabled: false } });
    }
  });

  it('keeps normal scalar, falsy, control and undefined error parsing', () => {
    const runtime = getRuntime();
    const Model = model();
    for (const query of [null, undefined, false, 0, '']) assert.deepStrictEqual(runtime.Cursor.parseQuery(query, Model), { find: {}, cursor: {} });
    assert.deepStrictEqual(runtime.Cursor.parseQuery(7, Model), { find: { id: 7 }, cursor: { $one: true } });
    assert.deepStrictEqual(runtime.Cursor.parseQuery({ name: 'sample', $limit: 1 }, Model), { find: { name: 'sample' }, cursor: { $limit: 1 } });
    assert.deepStrictEqual(runtime.Cursor.parseQuery(new Date(0), Model), { find: {}, cursor: {} });
    assert.deepStrictEqual(runtime.Cursor.parseQuery(function query() {}, Model), { find: {}, cursor: {} });
    assert.throws(() => runtime.Cursor.parseQuery({ nested: { value: undefined } }, Model), /Unexpected undefined for query key 'nested.value'/);
    assert.throws(() => runtime.Cursor.parseQuery({ nested: [undefined] }, Model), /Unexpected undefined for query key 'nested.0'/);
  });
}
