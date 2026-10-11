type Dynamic = any;

function tag(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return `${typeof value}:${String(value)}`;
}

function callbackObservation(invoke: (callback: (error?: unknown, value?: unknown) => unknown) => unknown): Record<string, unknown> {
  let callbackArguments: unknown[] = [];
  const returned = invoke((...arguments_: unknown[]) => {
    callbackArguments = arguments_;
    return 'callback-return';
  });
  return {
    arguments: callbackArguments.map((value) => (value instanceof Error ? `error:${value.message}` : value)),
    return: tag(returned),
  };
}

class RenderModel {
  attributes: Record<string, unknown>;
  related?: RenderModel | RenderModel[];

  constructor(attributes: Record<string, unknown>, related?: RenderModel | RenderModel[]) {
    this.attributes = attributes;
    this.related = related;
  }

  get(key: string, callback: (error: Error | null, value?: unknown) => unknown): unknown {
    const value = key === 'related' ? this.related : this.attributes[key];
    callback(null, value);
    return `get:${key}`;
  }

  relation(key: string): unknown {
    if (key !== 'related') return undefined;
    return {
      cursor: (_model: RenderModel, _field: string, query?: Record<string, unknown>) => ({
        toJSON: (callback: (error: Error | null, value?: unknown) => unknown) => callback(null, query?.$count ? (Array.isArray(this.related) ? this.related.length : this.related ? 1 : 0) : this.related),
        toModels: (callback: (error: Error | null, value?: unknown) => unknown) => callback(null, this.related),
      }),
    };
  }

  toJSON(): Record<string, unknown> {
    return { ...this.attributes };
  }

  concatenate(left: string, right: string, callback: (error: Error | null, value?: unknown) => unknown): unknown {
    return callback(null, `${this.attributes[left]}${right}`);
  }
}

export default function observeJSONUtils(ORM: Dynamic): Record<string, unknown> {
  const JSONUtils = ORM.JSONUtils;
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...arguments_: unknown[]) => logs.push(arguments_.join(' '));

  const values = {
    array: [1, '2', '2021-02-03T04:05:06.000Z'],
    date: new Date('2020-01-02T03:04:05.000Z'),
    number: 123,
    numberString: '123',
    text: '日本語',
  };
  const queryRoundTrip = JSONUtils.parseQuery(JSONUtils.querify(values));
  const invalidQuery = JSONUtils.parseQuery({ empty: '', raw: 'not-json' });

  const inheritedDates = Object.create({ inherited: '2022-03-04T05:06:07.000Z' }) as Record<string, unknown>;
  inheritedDates.own = '2023-04-05T06:07:08.000Z';
  JSONUtils.parseDates(inheritedDates);

  const integerModelType = {
    model_name: 'IntegerModel',
    schema: () => ({ idType: (key: string) => (key === 'id' ? 'Integer' : 'String') }),
  };
  const parsedObject = JSONUtils.parse({ at: '2020-01-02T03:04:05.000Z', id: '12', invalid: 'x' }, integerModelType);
  const sparse: unknown[] = [];
  sparse.length = 3;
  sparse[1] = '2021-02-03T04:05:06.000Z';
  const parsedSparse = JSONUtils.parse(sparse);
  let nullSchemaError: string | undefined;
  try {
    JSONUtils.parseField('1', { schema: () => null }, 'id');
  } catch (error) {
    nullSchemaError = (error as Error).message;
  }
  const invalidInteger = JSONUtils.parseField('not-an-integer', integerModelType, 'id');
  const toQueryReturn = JSONUtils.toQuery({ ignored: true });
  console.log = originalLog;

  const circular: Dynamic = {};
  circular.self = circular;
  const nested = { child: { value: 1 } };
  const shallow = JSONUtils.deepClone(nested);
  const depthOne = JSONUtils.deepClone(nested, 1);
  const date = new Date('2024-05-06T07:08:09.000Z');
  const clonedDate = JSONUtils.deepClone(date);
  const customClone = { clone: () => ({ cloned: true }) };
  class Reference {
    value = 1;
  }
  const reference = new Reference();

  const inheritedValues = Object.create({ inherited: 2 }) as Record<string, unknown>;
  inheritedValues.own = 1;
  const querifiedInherited = JSONUtils.querify(inheritedValues);

  const related = [new RenderModel({ id: 2, name: 'two' }), new RenderModel({ id: 3, name: 'three' })];
  const model = new RenderModel({ id: 1, name: 'one' }, related);
  const error = new Error('get failed');
  const failingModel = {
    get: (_key: string, callback: (error: Error) => unknown) => callback(error),
    relation: () => undefined,
  };

  const result = {
    clone: {
      custom: JSONUtils.deepClone(customClone),
      dateEqual: clonedDate.getTime() === date.getTime(),
      dateIdentity: clonedDate === date,
      depthOneChildIdentity: depthOne.child === nested.child,
      referenceIdentity: JSONUtils.deepClone(reference) === reference,
      shallowChildIdentity: shallow.child === nested.child,
    },
    empty: {
      empty: JSONUtils.isEmptyObject({}),
      inherited: JSONUtils.isEmptyObject(Object.create({ value: 1 })),
      null: JSONUtils.isEmptyObject(null),
      own: JSONUtils.isEmptyObject({ value: 1 }),
    },
    logs,
    parse: {
      inherited: inheritedDates,
      inheritedOwn: Object.prototype.hasOwnProperty.call(inheritedDates, 'inherited'),
      invalidInteger,
      invalidQuery,
      nullSchemaError,
      object: parsedObject,
      sparse: { keys: Object.keys(parsedSparse), value: parsedSparse },
      queryRoundTrip,
      toQueryReturn: tag(toQueryReturn),
    },
    query: { inherited: querifiedInherited },
    render: {
      dsl: callbackObservation((callback) =>
        JSONUtils.renderTemplate(
          model,
          {
            $select: ['id', 'name'],
            joined: { method: 'concatenate', args: ['name', '!'] },
            relatedCount: { key: 'related', $count: true },
            renamed: 'name',
          },
          callback
        )
      ),
      error: callbackObservation((callback) => JSONUtils.renderKey(failingModel, 'name', callback)),
      functionTemplate: callbackObservation((callback) => JSONUtils.renderTemplate(model, (value: RenderModel, _options: object, done: (error: null, json: unknown) => unknown) => done(null, value.attributes.name), callback)),
      key: callbackObservation((callback) => JSONUtils.renderKey(model, 'name', callback)),
      keys: callbackObservation((callback) => JSONUtils.renderKeys(model, ['id', 'name'], callback)),
      many: callbackObservation((callback) => JSONUtils.renderTemplate([model, ...related], 'name', callback)),
      null: callbackObservation((callback) => JSONUtils.renderTemplate(null, 'name', callback)),
      related: callbackObservation((callback) => JSONUtils.renderRelated(model, 'related', ['id', 'name'], callback)),
    },
    stringify: {
      circular: JSONUtils.stringify(circular),
      undefined: tag(JSONUtils.stringify(undefined)),
      value: JSONUtils.stringify({ id: 1 }),
    },
  };
  return JSON.parse(JSON.stringify(result));
}
