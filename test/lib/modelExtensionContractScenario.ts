type Dynamic = any;

function tag(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return `${typeof value}:${String(value)}`;
}

function completion(invoke: (callback: (error?: Error | null) => unknown) => unknown): Promise<{ returned: string }> {
  return new Promise((resolve, reject) => {
    let returned: unknown;
    returned = invoke((error) => {
      if (error) reject(error);
      else resolve({ returned: tag(returned) });
    });
  });
}

function result<T>(invoke: (callback: (error: Error | null, value?: T) => unknown) => unknown): Promise<{ returned: string; value: T | undefined }> {
  return new Promise((resolve, reject) => {
    let returned: unknown;
    returned = invoke((error, value) => {
      if (error) reject(error);
      else resolve({ returned: tag(returned), value });
    });
  });
}

async function observeUtils(ORM: Dynamic): Promise<Record<string, unknown>> {
  const Utils = ORM.Utils;
  const state: Dynamic = {};
  const setReturn = Utils.set(state, 'zero', 0);
  const orSetExisting = Utils.orSet(state, 'zero', 9);
  const orSetMissing = Utils.orSet(state, 'missing', false);
  const getMissing = Utils.get(state, 'absent', 'fallback');
  const unsetReturn = Utils.unset(state, 'missing');

  const callbackArguments: unknown[][] = [];
  const callback = Utils.bbCallback((...arguments_: unknown[]) => {
    callbackArguments.push(arguments_.map(tag));
    return 'callback-return';
  });
  const successReturn = callback.success('model', 'response', { marker: true });
  const errorReturn = callback.error('model', null, { marker: false });

  const left = new ORM.Backbone.Model({ first: 1, second: 2 });
  const right = new ORM.Backbone.Model({ first: 1, second: 3 });
  const modelFields = ['first', 'second'];
  const jsonFields = ['first', '-second'];
  const fieldResult = Utils.fieldCompare(left, right, modelFields);
  const jsonResult = Utils.jsonFieldCompare({ first: 1, second: 2 }, { first: 1, second: 3 }, jsonFields);

  return {
    callback: { arguments: callbackArguments, errorReturn: tag(errorReturn), successReturn: tag(successReturn) },
    data: {
      idFalse: tag(Utils.dataId(false)),
      idObject: tag(Utils.dataId({ id: 7 })),
      sameFalsy: Utils.dataIsSameModel({ id: 0, value: 1 }, { id: 0, value: 1 }),
      sameTruthy: Utils.dataIsSameModel({ id: 7 }, 7),
    },
    state: { getMissing: tag(getMissing), orSetExisting: tag(orSetExisting), orSetMissing: tag(orSetMissing), setReturn: tag(setReturn), state, unsetReturn },
    sorting: { fieldResult, jsonResult, modelFields, jsonFields },
  };
}

export default async function observeModelExtensionContract(ORM: Dynamic, prefix: string): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: true, max: 100 } });
  const ModelType = ORM.Backbone.Model.extend({
    model_name: `${prefix}ExtensionModel`,
    schema() {
      return { at: 'Date', group: 'String', name: 'String' };
    },
  });
  ModelType.prototype.sync = ORM.sync(ModelType);
  const saved: Dynamic[] = [];
  for (let index = 0; index < 7; index += 1) {
    const model = new ModelType({ at: new Date(Date.UTC(2020, 0, index + 1)), group: 'all', name: `name-${index + 1}` });
    await completion((callback) => model.save(callback));
    saved.push(model);
  }

  const getArguments: unknown[] = [];
  const getReturn = saved[0].get('name', (...arguments_: unknown[]) => getArguments.push(...arguments_.map(tag)));
  const eachOrder: number[] = [];
  const each = await result<number>((callback) =>
    ModelType.each(
      { $each: { fetch: 2, threads: 1 } },
      (model: Dynamic, next: (error?: Error | null) => unknown) => {
        eachOrder.push(model.id);
        return next();
      },
      callback
    )
  );
  const jsonNames: string[] = [];
  const jsonEach = await result<number>((callback) =>
    ModelType.each(
      { $each: { fetch: 3, json: true } },
      (json: Dynamic, next: (error?: Error | null) => unknown) => {
        jsonNames.push(json.name);
        return next();
      },
      callback
    )
  );
  const failure = new Error('model each failed');
  const errorOrder: number[] = [];
  let errorIdentity = false;
  const errorReturn = await new Promise<string>((resolve) => {
    let returned: unknown;
    returned = ModelType.each(
      { $each: { fetch: 2 } },
      (model: Dynamic, next: (error?: Error | null) => unknown) => {
        errorOrder.push(model.id);
        return next(model.id === 3 ? failure : null);
      },
      (error: unknown) => {
        errorIdentity = error === failure;
        resolve(tag(returned));
      }
    );
  });

  const intervalStarts: string[] = [];
  await completion((callback) =>
    ModelType.interval(
      { $interval: { key: 'at', length: 2, type: 'days' } },
      (_query: unknown, information: Dynamic, next: (error?: Error | null) => unknown) => {
        intervalStarts.push(information.start.toISOString());
        return next();
      },
      callback
    )
  );

  const streamIds = await new Promise<number[]>((resolve, reject) => {
    const ids: number[] = [];
    const stream = ModelType.stream({ $each: { fetch: 2 } });
    stream.on('data', (model: Dynamic) => ids.push(model.id));
    stream.on('error', reject);
    stream.on('end', () => resolve(ids));
  });

  const collection = new ORM.Backbone.Collection([], { model: ModelType });
  collection.add({ id: saved[0].id, name: 'collection-update' });
  const collectionModel = collection.at(0);

  const clone = saved[0].clone();
  return {
    collection: { cacheIdentity: collectionModel === saved[0], name: collectionModel.get('name') },
    each: { errorIdentity, errorOrder, errorReturn, jsonEach, jsonNames, result: each, order: eachOrder },
    intervalStarts,
    model: {
      cloneIdentity: clone === saved[0],
      cloneJSON: clone.toJSON(),
      getArguments,
      getReturn: tag(getReturn),
      isLoaded: saved[0].isLoaded(),
      staticNames: ['all', 'count', 'cursor', 'destroy', 'each', 'eachC', 'exists', 'find', 'findOne', 'findOrCreate', 'interval', 'intervalC', 'resetSchema', 'stream'].map((key) => typeof ModelType[key]),
    },
    streamIds,
    utils: await observeUtils(ORM),
  };
}
