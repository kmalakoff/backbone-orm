import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

describe('Fabricator', () => {
  it('retains constructible class identity and public method arity', () => {
    const Constructor: unknown = ORM.Fabricator;
    if (typeof Constructor !== 'function') throw new TypeError('Fabricator must remain a function');
    const instance = new ORM.Fabricator();
    assert.ok(instance instanceof Constructor);
    assert.throws(() => Reflect.apply(Constructor, undefined, []), TypeError);

    for (const [name, arity] of [
      ['value', 1],
      ['increment', 1],
      ['uniqueId', 1],
      ['date', 2],
    ] as const) {
      const method: unknown = Reflect.get(ORM.Fabricator, name);
      if (typeof method !== 'function') throw new TypeError(`Missing Fabricator method: ${name}`);
      assert.strictEqual(method.length, arity);
      assert.deepStrictEqual(Object.getOwnPropertyDescriptor(method, 'length'), { value: arity, writable: false, enumerable: false, configurable: true });
    }
    assert.strictEqual(ORM.Fabricator.uniqueString, ORM.Fabricator.uniqueId);
  });

  it('preserves explicit undefined and ignored extra arguments for JavaScript callers', () => {
    const undefinedIncrement: unknown = Reflect.apply(ORM.Fabricator.increment, ORM.Fabricator, [undefined]);
    if (typeof undefinedIncrement !== 'function') throw new TypeError('Explicit undefined increment must create a generator');
    assert.deepStrictEqual([undefinedIncrement(), undefinedIncrement()], [NaN, NaN]);

    const undefinedPrefix: unknown = Reflect.apply(ORM.Fabricator.uniqueId, ORM.Fabricator, [undefined]);
    if (typeof undefinedPrefix !== 'function') throw new TypeError('Explicit undefined prefix must create a generator');
    assert.strictEqual(typeof undefinedPrefix(), 'string');

    const before = Date.now();
    const undefinedDateStep: unknown = Reflect.apply(ORM.Fabricator.date, ORM.Fabricator, [undefined]);
    if (typeof undefinedDateStep !== 'function') throw new TypeError('Explicit undefined date step must create a generator');
    const first: unknown = undefinedDateStep();
    const second: unknown = undefinedDateStep();
    assert.ok(first instanceof Date);
    assert.ok(second instanceof Date);
    assert.ok(first.getTime() >= before && first.getTime() <= Date.now());
    assert.ok(Number.isNaN(second.getTime()));
    assert.throws(() => Reflect.apply(ORM.Fabricator.date, ORM.Fabricator, [undefined, 1]), TypeError);

    const extraValue: unknown = Reflect.apply(ORM.Fabricator.value, ORM.Fabricator, ['first', 'ignored']);
    if (typeof extraValue !== 'function') throw new TypeError('Value must create a generator');
    assert.strictEqual(extraValue(), 'first');
    const extraIncrement: unknown = Reflect.apply(ORM.Fabricator.increment, ORM.Fabricator, [4, 'ignored']);
    if (typeof extraIncrement !== 'function') throw new TypeError('Increment must create a generator');
    assert.deepStrictEqual([extraIncrement(), extraIncrement()], [4, 5]);
  });

  it('creates unsaved models from values, generators, and inherited attribute options', () => {
    interface Attributes extends Backbone.ObjectHash {
      inherited: string;
      sequence: number;
      shared: object;
    }

    class FabricatedModel extends Backbone.Model<Attributes> {}

    const shared = {};
    let sequence = 3;
    const attributes = Object.assign(Object.create({ inherited: 'from-prototype' }) as object, {
      sequence: () => sequence++,
      shared,
    }) as {
      inherited: string;
      sequence: () => number;
      shared: object;
    };
    const models = ORM.Fabricator.new(FabricatedModel, 2, attributes);

    assert.strictEqual(models.length, 2);
    assert.ok(models.every((model) => model instanceof FabricatedModel));
    assert.deepStrictEqual(
      models.map((model) => model.toJSON()),
      [
        { inherited: 'from-prototype', sequence: 3, shared },
        { inherited: 'from-prototype', sequence: 4, shared },
      ]
    );
    assert.deepStrictEqual(ORM.Fabricator.new(FabricatedModel, 0, attributes), []);
  });

  it('saves real memory models and returns the callback result', () => {
    class FabricatedModel extends Backbone.Model<{ name: string }> {
      get model_name() {
        return 'OwnedFabricatorMemoryModel';
      }

      schema() {
        return { name: 'String' };
      }
    }

    const Model = ORM.configureModel(FabricatedModel);
    let callbackModels: FabricatedModel[] | undefined;
    const returned = ORM.Fabricator.create(Model, 2, { name: ORM.Fabricator.uniqueId('fabricated_') }, (error, models) => {
      assert.ifError(error);
      callbackModels = models;
      return 'fabricator-callback-return';
    });

    assert.strictEqual(returned, 'fabricator-callback-return');
    assert.strictEqual(callbackModels?.length, 2);
    assert.deepStrictEqual(
      callbackModels?.map((model) => model.id),
      [1, 2]
    );
  });

  it('preserves argument-count distinctions and generator identity', () => {
    assert.strictEqual(ORM.Fabricator.value(), undefined);
    const undefinedValue = ORM.Fabricator.value(undefined);
    assert.strictEqual(typeof undefinedValue, 'function');
    assert.strictEqual(undefinedValue(), undefined);

    const shared = {};
    const sharedValue = ORM.Fabricator.value(shared);
    assert.strictEqual(sharedValue(), shared);
    assert.strictEqual(sharedValue(), shared);

    assert.strictEqual(ORM.Fabricator.increment(), undefined);
    const increment = ORM.Fabricator.increment(4);
    assert.deepStrictEqual([increment(), increment(), increment()], [4, 5, 6]);

    assert.strictEqual(ORM.Fabricator.uniqueString, ORM.Fabricator.uniqueId);
    assert.strictEqual(typeof ORM.Fabricator.uniqueId(), 'string');
    const unique = ORM.Fabricator.uniqueId('owned_');
    const uniqueValues = [unique(), unique(), unique()];
    assert.strictEqual(new Set(uniqueValues).size, 3);
    assert.ok(uniqueValues.every((value) => value.startsWith('owned_')));
  });

  it('preserves all date overloads', () => {
    const before = Date.now();
    const now = ORM.Fabricator.date();
    assert.ok(now.getTime() >= before);
    assert.ok(now.getTime() <= Date.now());

    const steppedFromNow = ORM.Fabricator.date(10);
    const first = steppedFromNow();
    assert.strictEqual(steppedFromNow().getTime() - first.getTime(), 10);
    assert.strictEqual(steppedFromNow().getTime() - first.getTime(), 20);

    const start = new Date('2020-01-02T03:04:05.000Z');
    const steppedFromStart = ORM.Fabricator.date(start, 25);
    assert.deepStrictEqual(
      [steppedFromStart(), steppedFromStart(), steppedFromStart()].map((value) => value.toISOString()),
      ['2020-01-02T03:04:05.000Z', '2020-01-02T03:04:05.025Z', '2020-01-02T03:04:05.050Z']
    );
  });
});
