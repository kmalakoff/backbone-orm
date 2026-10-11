type Dynamic = any;
type Callback = (error?: Error | null, value?: Dynamic) => Dynamic;

function callbackResult(register: (callback: Callback) => unknown): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    try {
      register((error, value) => (error ? reject(error) : resolve(value)));
    } catch (error) {
      reject(error);
    }
  });
}

function cursorResult(cursor: Dynamic, method = 'toJSON'): Promise<Dynamic> {
  return callbackResult((callback) => cursor[method](callback));
}

function save(model: Dynamic): Promise<Dynamic> {
  return callbackResult((callback) => model.save(callback));
}

function dispatch(sync: Dynamic, method: string, ...args: Dynamic[]): Dynamic {
  return Reflect.apply(sync, undefined, [method, ...args]);
}

function observeDispatch(sync: Dynamic, method: string, model: Dynamic, options: Record<string, unknown> = {}): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    const callbacks = {
      ...options,
      error(error: Error) {
        reject(error);
      },
      success(value: Dynamic) {
        resolve(value);
      },
    };
    try {
      dispatch(sync, method, model, callbacks);
    } catch (error) {
      reject(error);
    }
  });
}

function ids(value: Dynamic[]): unknown[] {
  return value.map((row: Dynamic) => row.id);
}

function modelId(value: Dynamic): unknown {
  return value && value.id;
}

async function observeRelations(ORM: Dynamic, Backbone: Dynamic, cacheEnabled: boolean, suffix: string): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
  let Author: Dynamic;
  let Book: Dynamic;
  Author = Backbone.Model.extend({
    model_name: `Author${suffix}`,
    schema() {
      return { books: () => ['hasMany', Book, { as: 'author' }], name: 'String' };
    },
  });
  Book = Backbone.Model.extend({
    model_name: `Book${suffix}`,
    schema() {
      return { author: () => ['belongsTo', Author], title: 'String' };
    },
  });
  Author.prototype.sync = ORM.sync(Author);
  Book.prototype.sync = ORM.sync(Book);

  const relation = Book.relation('author');
  const foreignKey = relation.foreign_key;
  Author.store.splice(0, Author.store.length, { id: 1, name: 'Ada' }, { id: 2, name: 'Grace' });
  Book.store.splice(
    0,
    Book.store.length,
    { id: 10, title: 'Notes', [foreignKey]: 1 },
    { id: 11, title: 'Letters', [foreignKey]: 1 },
    { id: 12, title: 'Compiler', [foreignKey]: 2 }
  );

  const relatedRows = await cursorResult(Author.cursor({ 'books.title': 'Notes' }));
  const relatedById = await cursorResult(Book.cursor({ 'author.id': 1 }));
  const plain = await cursorResult(Book.cursor({ $include: 'author' }));
  const firstModels = await cursorResult(Book.cursor({ $include: 'author' }), 'toModels');
  const secondModels = await cursorResult(Book.cursor({ $include: 'author' }), 'toModels');
  const firstAuthors = firstModels.map((book: Dynamic) => book.get('author'));
  const secondAuthors = secondModels.map((book: Dynamic) => book.get('author'));

  return {
    cacheHasIncludedAuthor: cacheEnabled ? Author.cache.get(1) === firstAuthors[0] : Author.cache == null,
    includedJSONIsPlain: plain.every((book: Dynamic) => book.author && !(book.author instanceof Backbone.Model)),
    materializedAuthorsAreModels: firstAuthors.every((author: Dynamic) => author instanceof Author),
    relationIdQueryIds: ids(relatedById),
    relationQueryIds: ids(relatedRows),
    repeatedAuthorIdentity: firstAuthors[0] === secondAuthors[0],
    sharedAuthorIdentity: firstAuthors[0] === firstAuthors[1],
  };
}

async function observeIncludeBoundaries(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false } });
  let Author: Dynamic;
  let Book: Dynamic;
  Author = Backbone.Model.extend({
    model_name: 'CursorContractBoundaryAuthor',
    schema() {
      return { books: () => ['hasMany', Book, { as: 'author' }], name: 'String' };
    },
  });
  Book = Backbone.Model.extend({
    model_name: 'CursorContractBoundaryBook',
    schema() {
      return { author: () => ['belongsTo', Author], title: 'String' };
    },
  });
  Author.prototype.sync = ORM.sync(Author);
  Book.prototype.sync = ORM.sync(Book);

  const foreignKey = Book.relation('author').foreign_key;
  const empty = await cursorResult(Book.cursor({ $include: 'author' }));
  Author.store.push({ id: 1, name: 'Boundary Author' });
  Book.store.push({ id: 1, title: '0', [foreignKey]: 1 });
  const one = await cursorResult(Book.cursor({ $include: 'author' }));
  for (let id = 2; id <= 2500; id += 1) Book.store.push({ id, title: String(id - 1), [foreignKey]: 1 });
  const large = await cursorResult(Book.cursor({ $include: 'author' }));

  return {
    emptyLength: empty.length,
    largeFirstAuthor: large[0].author.name,
    largeLastAuthor: large.at(-1).author.name,
    largeLength: large.length,
    oneAuthor: one[0].author.name,
    oneLength: one.length,
  };
}

function observeCacheError(sync: Dynamic, method: string, model: Dynamic, returnValue: string): Record<string, unknown> {
  let argumentMessages: string[] = [];
  let receiverIsOptions = false;
  const options = {
    error(...errors: Error[]) {
      argumentMessages = errors.map((error) => error.message);
      receiverIsOptions = this === options;
      return returnValue;
    },
    success() {
      throw new Error(`${method} unexpectedly succeeded`);
    },
  };
  const returned = dispatch(sync, method, model, options);
  const omittedHandlerReturn = dispatch(sync, method, model, {
    success() {
      throw new Error(`${method} unexpectedly succeeded without an error handler`);
    },
  });
  return {
    argumentMessages,
    omittedHandlerReturnIsUndefined: omittedHandlerReturn === undefined,
    receiverIsOptions,
    returned,
  };
}

function observeCacheErrors(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  ORM.configure({ model_cache: { enabled: true, max: 100 } });
  const Automatic = Backbone.Model.extend({
    model_name: 'CursorContractAutomaticErrorModel',
    schema() {
      return { name: 'String' };
    },
  });
  const Manual = Backbone.Model.extend({
    model_name: 'CursorContractManualErrorModel',
    schema() {
      return { id: ['Integer', { manual: true }], name: 'String' };
    },
  });
  Automatic.prototype.sync = ORM.sync(Automatic);
  Manual.prototype.sync = ORM.sync(Manual);
  return {
    create: observeCacheError(Manual.prototype.sync, 'create', new Manual({ name: 'missing-id' }), 'create-error-return'),
    update: observeCacheError(Automatic.prototype.sync, 'update', new Automatic({ id: 404, name: 'missing' }), 'update-error-return'),
  };
}

async function observeCache(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: true, max: 100 } });
  const Cached = Backbone.Model.extend({
    model_name: 'CursorContractCacheModel',
    schema() {
      return { name: 'String' };
    },
  });
  Cached.prototype.sync = ORM.sync(Cached);
  const sync = Cached.prototype.sync;

  const original = new Cached({ name: 'cached' });
  await save(original);
  const cachedIdentity = Cached.cache.get(original.id) === original;
  Cached.store[0].name = 'stored';
  const ordinaryRead = await observeDispatch(sync, 'read', new Cached({ id: original.id }));
  const forcedRead = await observeDispatch(sync, 'read', new Cached({ id: original.id }), { force: true });

  const replacement = new Cached({ id: original.id, name: 'updated' });
  await observeDispatch(sync, 'update', replacement);
  const updateKeptIdentity = Cached.cache.get(original.id) === original;
  const updatedName = original.get('name');
  await observeDispatch(sync, 'delete', replacement);
  const deleteClearedCache = Cached.cache.get(original.id) === undefined;

  const resetTarget = new Cached({ name: 'reset' });
  await save(resetTarget);
  await callbackResult((callback) => dispatch(sync, 'resetSchema', {}, callback));
  const resetClearedBoth = Cached.store.length === 0 && Cached.cache.get(resetTarget.id) === undefined;

  const connectTarget = new Cached({ name: 'connect' });
  await save(connectTarget);
  dispatch(sync, 'connect', '/ignored');
  const connectClearedCache = Cached.cache.get(connectTarget.id) === undefined;

  return {
    cachedIdentity,
    connectClearedCache,
    deleteClearedCache,
    forcedReadName: forcedRead.name,
    ordinaryReadName: ordinaryRead.name,
    resetClearedBoth,
    updatedName,
    updateKeptIdentity,
  };
}

function observeCachePolicy(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  ORM.configure({ model_cache: { enabled: true, max: 100 } });
  const Model = Backbone.Model.extend({
    model_name: 'CursorContractCachePolicyModel',
    schema() {
      return {};
    },
  });
  Model.prototype.sync = ORM.sync(Model);
  const cacheSync = dispatch(Model.prototype.sync, 'sync');
  const cacheCursorParseQuery = typeof cacheSync.cursor().constructor.parseQuery;
  let destroyQuery;
  Model.each = (query: Dynamic, _iterator: Dynamic, callback: Callback) => {
    destroyQuery = query;
    return callback();
  };
  cacheSync.destroy({ group: 'remove' }, () => undefined);

  const connectOrder: string[] = [];
  Model.cache.reset = () => {
    connectOrder.push('reset');
    return Model.cache;
  };
  cacheSync.wrapped_sync_fn = (method: string) => connectOrder.push(method);
  cacheSync.connect('/database');
  return { cacheCursorParseQuery, connectOrder, destroyQuery };
}

export default async function observe(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, Dynamic>> {
  ORM.configure({ model_cache: { enabled: false } });
  const Flat = Backbone.Model.extend({
    model_name: 'CursorContractFlat',
    parse(attributes: Dynamic) {
      return { ...attributes, parsed_name: attributes.name && attributes.name.toUpperCase() };
    },
    schema() {
      return { a: 'Integer', b: 'String', details: 'JSON', group: 'String', name: 'String', stamp: 'Date' };
    },
  });
  Flat.prototype.sync = ORM.sync(Flat);
  Flat.store.splice(
    0,
    Flat.store.length,
    { id: 1, a: 1, b: 'first', details: { name: 'first' }, group: 'same', name: 'alpha', stamp: new Date('2020-01-01T00:00:00.000Z') },
    { id: 2, a: 2, b: 'second', details: { name: 'second' }, group: 'same', name: 'beta', stamp: new Date('2021-01-01T00:00:00.000Z') }
  );

  const options = { model_type: Flat, store: Flat.store };
  const Base = ORM.Cursor;
  const Memory = ORM.sync.Cursor;
  const result: Record<string, Dynamic> = {};

  result.constructorRoles = {
    baseHasBuildFindQuery: typeof Base.prototype.buildFindQuery,
    concreteHasBuildFindQuery: typeof Memory.prototype.buildFindQuery,
    distinct: Base !== Memory,
    inherited: Object.getPrototypeOf(Memory.prototype) === Base.prototype,
  };
  result.staticMethods = {
    inheritedParseQuery: typeof Memory.parseQuery,
    parseQuery: typeof Base.parseQuery,
    validateQuery: typeof Base.validateQuery,
  };
  result.baseMethods = Object.fromEntries(
    ['queryToJSON', 'prepareIncludes', 'execWithCursorQuery', 'relatedModelTypesInQuery', 'selectFromModels'].map((key) => [key, typeof Base.prototype[key]])
  );
  result.falsyParsing = [null, false, 0, ''].map((query) => Base.parseQuery(query, Flat));
  result.nonPlainParsing = {
    date: Base.parseQuery(new Date('2020-01-01T00:00:00.000Z'), Flat),
    function: Base.parseQuery(function queryFunction() {}, Flat),
  };
  result.scalarParsing = Base.parseQuery(7, Flat);
  try {
    new Base({ nested: { bad: undefined } }, options);
    result.undefinedRejected = false;
  } catch (_error) {
    result.undefinedRejected = true;
  }
  try {
    Base.validateQuery({ values: [undefined] }, null, Flat);
    result.undefinedInArrayRejected = false;
  } catch (_error) {
    result.undefinedInArrayRejected = true;
  }
  try {
    Base.validateQuery({ values: [[undefined]] }, null, Flat);
    result.undefinedInNestedArrayRejected = false;
  } catch (_error) {
    result.undefinedInNestedArrayRejected = true;
  }

  const chained = new Base({ $select: ['a', 'b', 'name'], $values: ['a', 'b'], $whitelist: ['a', 'name'] }, options);
  chained.select(['a', 'name']);
  chained.values(['a', 'b']);
  chained.whiteList(['name', 'a']);
  result.chainedModifiers = {
    select: chained._cursor.$select,
    values: chained._cursor.$values,
    whitelist: chained._cursor.$whitelist,
  };
  result.selections = {
    pageValues: new Base({ $page: true, $values: ['a', 'b'] }, options).selectResults(Flat.store),
    selected: new Base({ $select: ['a', 'b'], $whitelist: ['b'] }, options).selectResults(Flat.store),
    singleOneValue: new Base({ $one: true, $values: 'a' }, options).selectResults(Flat.store),
    values: new Base({ $values: ['a', 'b'] }, options).selectResults(Flat.store),
  };

  function Adapter(this: Dynamic, query: Dynamic, adapterOptions: Dynamic) {
    return Adapter.__super__.constructor.apply(this, arguments);
  }
  Adapter.__super__ = Memory.prototype;
  Adapter.prototype = Object.create(Memory.prototype);
  Adapter.prototype.constructor = Adapter;
  Adapter.prototype.queryToJSON = function queryToJSON(callback: Callback) {
    return callback(null, 'adapter-owned-result');
  };
  const AdapterConstructor = Adapter as unknown as new (query: Dynamic, adapterOptions: Dynamic) => Dynamic;
  const adapter = new AdapterConstructor({}, options);
  result.adapter = {
    instanceOfConcrete: adapter instanceof Memory,
    returnValue: adapter.toJSON((_error: Error | null, value: Dynamic) => {
      result.adapterValue = value;
      return 'adapter-callback-return';
    }),
  };
  const errorCursor = new AdapterConstructor({}, options);
  errorCursor.queryToJSON = (callback: Callback) => callback(new Error('adapter-owned-error'));
  let errorCallbackCount = 0;
  result.dispatchErrors = {
    callbackReturn: errorCursor.toJSON((error: Error) => {
      errorCallbackCount += 1;
      result.adapterErrorMessage = error.message;
      return 'error-callback-return';
    }),
    callbackThrowsThrough: false,
  };
  result.dispatchErrors.callbackCount = errorCallbackCount;
  const callbackError = new Error('callback-thrown-error');
  try {
    adapter.toJSON(() => {
      throw callbackError;
    });
  } catch (error) {
    result.dispatchErrors.callbackThrowsThrough = error === callbackError;
  }

  function DispatchCursor(this: Dynamic, query: Dynamic, cursorOptions: Dynamic) {
    return Base.call(this, query, cursorOptions);
  }
  DispatchCursor.prototype = Object.create(Base.prototype);
  DispatchCursor.prototype.constructor = DispatchCursor;
  const DispatchCursorConstructor = DispatchCursor as unknown as new (query: Dynamic, cursorOptions: Dynamic) => Dynamic;
  const dispatchCursor = new DispatchCursorConstructor({ $count: 'prior-count', $exists: '' }, options);
  const during: Array<Record<string, unknown>> = [];
  DispatchCursor.prototype.queryToJSON = function queryToJSON(callback: Callback) {
    during.push({ count: this._cursor.$count, exists: this._cursor.$exists });
    return callback(null, 2);
  };
  const countReturn = dispatchCursor.count(() => 'count-callback-return');
  const existsReturn = dispatchCursor.exists(() => 'exists-callback-return');
  result.flagRestoration = {
    after: { count: dispatchCursor._cursor.$count, exists: dispatchCursor._cursor.$exists },
    countReturn,
    during,
    existsReturn,
  };

  result.queryResults = {
    combinedIds: ids(await cursorResult(Flat.cursor({ a: { $gte: 1, $lt: 2 } }))),
    count: await cursorResult(Flat.cursor({}), 'count'),
    dateIds: ids(await cursorResult(Flat.cursor({ stamp: new Date('2020-01-01T00:00:00.000Z') }))),
    existsFalse: await cursorResult(Flat.cursor({ id: 404 }), 'exists'),
    existsIds: ids(await cursorResult(Flat.cursor({ a: { $exists: true } }))),
    existsTrue: await cursorResult(Flat.cursor({ id: 1 }), 'exists'),
    ids: ids(await cursorResult(Flat.cursor({ $ids: [2] }))),
    inIds: ids(await cursorResult(Flat.cursor({ a: { $in: [2, 3] } }))),
    missingIds: ids(await cursorResult(Flat.cursor({ missing: { $exists: false } }))),
    neIds: ids(await cursorResult(Flat.cursor({ a: { $ne: 1 } }))),
    nestedIds: ids(await cursorResult(Flat.cursor({ 'details.name': 'first' }))),
    ninIds: ids(await cursorResult(Flat.cursor({ a: { $nin: [2] } }))),
    objectIds: ids(await cursorResult(Flat.cursor({ details: { name: 'first' } }))),
    page: await cursorResult(Flat.cursor({ $limit: 1, $offset: 1, $page: true })),
    sortedLimitedIds: ids(await cursorResult(Flat.cursor({ $limit: 1, $sort: '-a' }))),
    uniquePage: await cursorResult(Flat.cursor({ $page: true, $unique: 'group' })),
    zero: await cursorResult(Flat.cursor({ $zero: true })),
    zeroOne: await cursorResult(Flat.cursor({ $one: true, $zero: true })),
  };

  const emptyModels = await cursorResult(Flat.cursor({ id: 404 }), 'toModels');
  const manyModels = await cursorResult(Flat.cursor({}), 'toModels');
  const missingOne = await cursorResult(Flat.cursor({ $one: true, id: 404 }), 'toModels');
  const oneModel = await cursorResult(Flat.cursor({ $one: true, id: 1 }), 'toModels');
  const partialModel = (await cursorResult(Flat.cursor({ $select: 'name' }), 'toModels'))[0];
  result.materialization = {
    emptyLength: emptyModels.length,
    manyIds: manyModels.map(modelId),
    missingOneIsNull: missingOne === null,
    oneIsModel: oneModel instanceof Flat,
    oneModelId: modelId(oneModel),
    partialIsPartial: partialModel.isPartial(),
    partialParsedName: partialModel.get('parsed_name'),
  };

  result.includeBoundaries = await observeIncludeBoundaries(ORM, Backbone);
  result.relations = {
    cacheOff: await observeRelations(ORM, Backbone, false, 'NoCache'),
    cacheOn: await observeRelations(ORM, Backbone, true, 'Cache'),
  };
  result.cache = await observeCache(ORM, Backbone);
  result.cacheErrors = observeCacheErrors(ORM, Backbone);
  result.cachePolicy = observeCachePolicy(ORM, Backbone);
  return result;
}
