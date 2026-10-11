import assert from 'assert';

import ORM from 'backbone-orm';

describe('JSONUtils', () => {
  it('round-trips strict query JSON and recursively parses dates', () => {
    const values = {
      date: new Date('2020-01-02T03:04:05.000Z'),
      number: 123,
      numberString: '123',
      text: '日本語',
    };
    assert.deepStrictEqual(ORM.JSONUtils.parseQuery(ORM.JSONUtils.querify(values)), values);

    const nested = { at: '2021-02-03T04:05:06.000Z', values: ['plain', '2022-03-04T05:06:07.000Z'] };
    const parsed = ORM.JSONUtils.parseDates(nested) as { at: Date; values: [string, Date] };
    assert.ok(parsed.at instanceof Date);
    assert.ok(parsed.values[1] instanceof Date);

    const sparse: unknown[] = [];
    sparse.length = 3;
    sparse[1] = '2022-03-04T05:06:07.000Z';
    const parsedSparse = ORM.JSONUtils.parse(sparse) as unknown[];
    assert.deepStrictEqual(Object.keys(parsedSparse), ['0', '1', '2']);
    assert.ok(parsedSparse[1] instanceof Date);
    assert.throws(() => ORM.JSONUtils.parseField('1', { schema: () => null }, 'id'), TypeError);
  });

  it('preserves shallow and depth-limited clone semantics', () => {
    const value = { child: { nested: { id: 1 } } };
    const shallow = ORM.JSONUtils.deepClone(value);
    const depthOne = ORM.JSONUtils.deepClone(value, 1);
    const depthTwo = ORM.JSONUtils.deepClone(value, 2);
    assert.notStrictEqual(shallow, value);
    assert.strictEqual(shallow.child, value.child);
    assert.notStrictEqual(depthOne.child, value.child);
    assert.strictEqual(depthOne.child.nested, value.child.nested);
    assert.notStrictEqual(depthTwo.child.nested, value.child.nested);
  });

  it('renders public Backbone models with callback returns and real relations', () => {
    const suffix = `${Date.now()}${Math.random()}`.replace('.', '');
    let Child: ReturnType<typeof ORM.Backbone.Model.extend>;
    const Parent = ORM.Backbone.Model.extend({
      model_name: `JSONParent${suffix}`,
      schema() {
        return { children: () => ['hasMany', Child, { as: 'parent' }] };
      },
    });
    Child = ORM.Backbone.Model.extend({
      model_name: `JSONChild${suffix}`,
      schema() {
        return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
      },
    });
    ORM.configureModel(Parent);
    ORM.configureModel(Child);

    const child = new Child({ id: 2, name: 'child' });
    const parent = new Parent({ id: 1, name: 'parent', children: [child] });
    let rendered: unknown;
    const result = ORM.JSONUtils.renderTemplate(parent, ['id', 'name'], (error, value) => {
      assert.ifError(error);
      rendered = value;
      return 'render-return';
    });
    assert.strictEqual(result, 'render-return');
    assert.deepStrictEqual(rendered, { id: 1, name: 'parent' });

    let children: unknown;
    ORM.JSONUtils.renderKey(parent, 'children', (error, value) => {
      assert.ifError(error);
      children = value;
    });
    assert.deepStrictEqual(children, [{ id: 2, name: 'child', parent_id: 1 }]);
  });
});
