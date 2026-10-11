type Dynamic = any;

function tag(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return `${typeof value}:${String(value)}`;
}

function errorTag(error: unknown): string {
  return error instanceof Error ? `${error.name}:${error.message}` : tag(error);
}

function direct(invoke: () => unknown): Record<string, unknown> {
  try {
    const value = invoke();
    return { returned: tag(value), threw: null, value };
  } catch (error) {
    return { returned: null, threw: errorTag(error), value: null };
  }
}

function callbackValue(invoke: (callback: (error: Error | null, value?: Dynamic) => unknown) => unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    try {
      invoke((error, value) => resolve({ error: error ? errorTag(error) : null, value }));
    } catch (error) {
      resolve({ error: errorTag(error), value: null });
    }
  });
}

function save(model: Dynamic): Promise<Record<string, unknown>> {
  return callbackValue((callback) => model.save(callback));
}

function streamIds(streamFactory: () => Dynamic): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const ids: unknown[] = [];
    try {
      const stream = streamFactory();
      stream.on('data', (model: Dynamic) => ids.push(model.id));
      stream.on('error', (error: unknown) => resolve({ error: errorTag(error), ids }));
      stream.on('end', () => resolve({ error: null, ids }));
    } catch (error) {
      resolve({ error: errorTag(error), ids });
    }
  });
}

function observeWrappedOptions(ORM: Dynamic, input: Dynamic): Record<string, unknown> {
  let observed: Dynamic;
  const wrapped = ORM.Utils.wrapOptions(input, (_error: unknown, _model: unknown, _response: unknown, options: Dynamic) => {
    observed = options;
  });
  wrapped.success('model', 'response', { ignored: true });
  return {
    empty: observed && Object.keys(observed).length === 0,
    inputIdentity: observed === input,
    observedType: tag(observed),
  };
}

export default async function observeModelDefaultContract(ORM: Dynamic, prefix: string): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  const ModelType = ORM.Backbone.Model.extend({
    model_name: `${prefix}DefaultModel`,
    schema() {
      return { name: 'String' };
    },
  });
  ModelType.prototype.sync = ORM.sync(ModelType);
  const model = new ModelType({ name: 'saved' });
  await save(model);

  const modelFetch = direct(() => model.fetch());
  const CollectionType = ORM.Backbone.Collection.extend({ model: ModelType });
  CollectionType.prototype.sync = ORM.sync(CollectionType);
  const collection = new CollectionType();
  const collectionFetch = direct(() => collection.fetch());
  const staticCursor = await callbackValue((callback) => ModelType.cursor(null).toJSON(callback));
  const stream = await streamIds(() => ModelType.stream(null));

  const nullJSON = direct(() => model.toJSON(null));
  const jsonDepthAfterNull = model._orm?.json;
  const normalJSON = direct(() => model.toJSON());
  const jsonDepthAfterNormal = model._orm?.json;

  let Parent: Dynamic;
  let Child: Dynamic;
  Parent = ORM.Backbone.Model.extend({
    model_name: `${prefix}DefaultParent`,
    schema() {
      return { children: () => ['hasMany', Child, { as: 'parent' }] };
    },
  });
  Child = ORM.Backbone.Model.extend({
    model_name: `${prefix}DefaultChild`,
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
    },
  });
  Parent.prototype.sync = ORM.sync(Parent);
  Child.prototype.sync = ORM.sync(Child);
  const parent = new Parent({ name: 'parent' });
  await save(parent);
  const instanceCursor = await callbackValue((callback) => parent.cursor('children', null).toJSON(callback));

  return {
    collectionFetch: { ...collectionFetch, length: collection.length },
    instanceCursor,
    modelFetch,
    staticCursor,
    stream,
    toJSON: { jsonDepthAfterNormal, jsonDepthAfterNull, normalJSON, nullJSON, sameIdentity: nullJSON.value === normalJSON.value },
    wrapOptions: {
      null: observeWrappedOptions(ORM, null),
      undefined: observeWrappedOptions(ORM, undefined),
    },
  };
}
