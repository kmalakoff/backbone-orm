interface DynamicFabricator {
  create(modelType: DynamicModelConstructor, count: number, attributes: Record<string, unknown>, callback: (error: Error | null | undefined, models: DynamicModel[]) => unknown): unknown;
  date(): Date;
  date(step: number): () => Date;
  date(start: Date, step: number): () => Date;
  increment(): undefined;
  increment(value: number): () => number;
  new: (modelType: DynamicModelConstructor, count: number, attributes: Record<string, unknown>) => DynamicModel[];
  uniqueId(): string;
  uniqueId(prefix: string): () => string;
  uniqueString: DynamicFabricator['uniqueId'];
  value(): undefined;
  value<T>(value: T): () => T;
}

interface DynamicModel {
  attributes: Record<string, unknown>;
  save(callback: (error?: Error | null) => unknown): unknown;
}

interface DynamicModelConstructor {
  new (attributes: Record<string, unknown>): DynamicModel;
}

interface DynamicRuntime {
  Fabricator: DynamicFabricator;
  TestUtils: {
    optionSets(): Array<Record<string, unknown>>;
  };
}

function returned(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return `${typeof value}:${String(value)}`;
}

export default function observeFabricatorTestUtils(runtime: DynamicRuntime): Record<string, unknown> {
  const Fabricator = runtime.Fabricator;
  const saveCalls: number[] = [];

  class Model implements DynamicModel {
    attributes: Record<string, unknown>;

    constructor(attributes: Record<string, unknown>) {
      this.attributes = attributes;
    }

    save(callback: (error?: Error | null) => unknown): unknown {
      const sequence = this.attributes.sequence as number;
      saveCalls.push(sequence);
      return callback(sequence === 2 ? new Error('fabricated-save-failure') : null);
    }
  }

  let sequence = 1;
  const attributes = Object.assign(Object.create({ inherited: 'inherited-value' }) as object, {
    fixed: 'fixed-value',
    sequence: () => sequence++,
  }) as Record<string, unknown>;
  const created = Fabricator.new(Model, 2.5, attributes);

  let createCallback: Record<string, unknown> | undefined;
  const createReturn = Fabricator.create(Model, 3, { sequence: Fabricator.increment(1) }, (error, models) => {
    createCallback = {
      error: error?.message ?? null,
      models: models.length,
    };
    return 'create-callback-return';
  });

  const undefinedValue = Fabricator.value(undefined);
  const increment = Fabricator.increment(4);
  const immediateUniqueId = Fabricator.uniqueId();
  const unique = Fabricator.uniqueId('prefix_');
  const uniqueValues = [unique(), unique(), unique()];
  const nowBefore = Date.now();
  const now = Fabricator.date();
  const nowAfter = Date.now();
  const stepped = Fabricator.date(new Date('2020-01-02T03:04:05.000Z'), 25);
  const optionSets = runtime.TestUtils.optionSets();
  const freshOptionSets = runtime.TestUtils.optionSets();
  optionSets[0].cache = true;
  optionSets[0].$tags = 'changed';

  return {
    create: {
      callback: createCallback,
      return: returned(createReturn),
      saveCalls,
    },
    date: {
      nowInRange: now.getTime() >= nowBefore && now.getTime() <= nowAfter,
      stepped: [stepped(), stepped(), stepped()].map((value) => value.toISOString()),
    },
    generators: {
      increment: [increment(), increment(), increment()],
      incrementWithoutArgument: returned(Fabricator.increment()),
      uniqueAlias: Fabricator.uniqueString === Fabricator.uniqueId,
      uniqueImmediateType: typeof immediateUniqueId,
      uniquePrefix: uniqueValues.every((value) => value.startsWith('prefix_')),
      uniqueSize: new Set(uniqueValues).size,
      valueExplicitUndefined: [typeof undefinedValue, returned(undefinedValue())],
      valueWithoutArgument: returned(Fabricator.value()),
    },
    models: created.map((model) => model.attributes),
    optionSets: {
      freshArray: optionSets !== freshOptionSets,
      freshObjects: optionSets.every((value, index) => value !== freshOptionSets[index]),
      second: freshOptionSets,
    },
  };
}
