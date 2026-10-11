type Dynamic = any;
type Callback = (error?: Error | null, value?: Dynamic) => Dynamic;

const hasOwn = (value: object, key: PropertyKey): boolean => Reflect.getOwnPropertyDescriptor(value, key) !== undefined;

function callbackResult(register: (callback: Callback) => unknown): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    register((error, value) => (error ? reject(error) : resolve(value)));
  });
}

function createType(name: string, prototypeProperties: Record<string, unknown> = {}): Dynamic {
  function Type() {}
  Type.model_name = name;
  Object.assign(Type.prototype, prototypeProperties);
  return Type;
}

function errorName(callback: () => unknown): string | undefined {
  try {
    callback();
  } catch (error) {
    return (error as Error).name;
  }
}

async function observeMemoryStore(ORM: Dynamic): Promise<Record<string, unknown>> {
  const MemoryStore = ORM.MemoryStore;
  const nullOptionsStore = new MemoryStore(null);
  const undefinedOptionsStore = new MemoryStore(undefined);
  nullOptionsStore.set('null-options', { id: 'null-options' });
  undefinedOptionsStore.set('undefined-options', { id: 'undefined-options' });
  const store = new MemoryStore({ max: 3 });
  const callbackArguments: Record<string, Dynamic[]> = {};
  const first = { id: 1, name: 'first' };
  const second = { id: 2, name: 'second' };

  const normalSetReturn = store.set('first', first, (...arguments_: unknown[]) => {
    callbackArguments.set = arguments_;
    return 'ignored-set-return';
  });
  const normalGetReturn = store.get('first', (...arguments_: unknown[]) => {
    callbackArguments.get = arguments_;
    return 'ignored-get-return';
  });
  store.set('second', second);
  const destroyReturn = store.destroy('second', (...arguments_: unknown[]) => {
    callbackArguments.destroy = arguments_;
    return 'ignored-destroy-return';
  });

  const detachedSet = store.set;
  const detachedGet = store.get;
  const detachedDestroy = store.destroy;
  const detachedReset = store.reset;
  const detachedForEach = store.forEach;
  detachedSet('detached', { id: 3, name: 'detached' });
  const detachedGetValue = detachedGet('detached');
  detachedDestroy('detached');
  detachedSet('iteration-a', { id: 4 });
  detachedSet('iteration-b', { id: 5 });
  const iteration: Array<Record<string, unknown>> = [];
  const forEachReturn = detachedForEach((value: Dynamic, key: unknown, cache: unknown) => {
    iteration.push({ cacheIsLRU: cache === store.cache, id: value.id, key });
  });
  const resetReturn = detachedReset((...arguments_: unknown[]) => {
    callbackArguments.reset = arguments_;
    return 'ignored-reset-return';
  });

  const never = { _orm_never_cache: true, id: 6 };
  const neverTruthyReturn = store.set('never-truthy', never, (...arguments_: unknown[]) => {
    callbackArguments.neverTruthy = arguments_;
    return 'never-callback-return';
  });
  const neverFalsyReturn = store.set('never-falsy', never, () => undefined);
  const neverWithoutCallbackReturn = store.set('never-without-callback', never);

  const aliasStore = new MemoryStore({ max: 2 });
  aliasStore.set('alias', { id: 7 });
  const aliasReturn = aliasStore.del('alias', (...arguments_: unknown[]) => {
    callbackArguments.del = arguments_;
    return 'ignored-del-return';
  });
  const detachedDelError = errorName(() => {
    const detachedDel = aliasStore.del;
    detachedDel('missing');
  });

  const capacityStore = new MemoryStore({ max: 2 });
  capacityStore.set('a', { id: 'a' });
  capacityStore.set('b', { id: 'b' });
  capacityStore.get('a');
  capacityStore.set('c', { id: 'c' });

  const expiringStore = new MemoryStore({ max: 2, max_age: 30 });
  expiringStore.set('expiring', { id: 'expiring' });
  const expirationBefore = expiringStore.get('expiring')?.id;
  await new Promise((resolve) => setTimeout(resolve, 80));
  const expirationAfter = expiringStore.get('expiring');

  const DerivedMemoryStore: Dynamic = class extends MemoryStore {};
  const derived = new DerivedMemoryStore({ max: 1 });
  derived.set('derived', { id: 'derived' });

  const callableReceiver: Record<string, Dynamic> = Object.create(MemoryStore.prototype);
  const callableReturn = Reflect.apply(MemoryStore, callableReceiver, [{ max: 1 }]);
  callableReceiver.set('callable', { id: 'callable' });

  return {
    alias: {
      aliasReturnsStore: aliasReturn === aliasStore,
      detachedDelError,
      destroyIsOwn: hasOwn(aliasStore, 'destroy'),
      instanceMethodsDiffer: aliasStore.del !== aliasStore.destroy,
      prototypeAliasShared: MemoryStore.prototype.del === MemoryStore.prototype.destroy,
    },
    bound: {
      destroyReturnsStore: destroyReturn === store,
      detachedGetId: detachedGetValue.id,
      detachedValueRemoved: detachedGet('detached') === undefined,
      forEachReturnIsUndefined: forEachReturn === undefined,
      getReturnsValue: normalGetReturn === first,
      resetReturnsStore: resetReturn === store,
      setReturnsStore: normalSetReturn === store,
    },
    callbacks: {
      del: callbackArguments.del,
      destroy: callbackArguments.destroy,
      get: [callbackArguments.get?.[0] ?? null, callbackArguments.get?.[1]?.id],
      neverTruthy: [callbackArguments.neverTruthy?.[0] ?? null, callbackArguments.neverTruthy?.[1]?.id],
      reset: callbackArguments.reset,
      set: [callbackArguments.set?.[0] ?? null, callbackArguments.set?.[1]?.id],
    },
    defaults: {
      nullCacheUsesBundledLRU: nullOptionsStore.cache instanceof ORM.modules['lru-cache'],
      nullGetId: nullOptionsStore.get('null-options')?.id,
      undefinedCacheUsesBundledLRU: undefinedOptionsStore.cache instanceof ORM.modules['lru-cache'],
      undefinedGetId: undefinedOptionsStore.get('undefined-options')?.id,
    },
    callable: {
      cacheUsesBundledLRU: callableReceiver.cache instanceof ORM.modules['lru-cache'],
      getId: callableReceiver.get('callable').id,
      returnIsUndefined: callableReturn === undefined,
    },
    capacity: {
      a: capacityStore.get('a')?.id,
      bIsEvicted: capacityStore.get('b') === undefined,
      c: capacityStore.get('c')?.id,
    },
    expiration: {
      afterIsUndefined: expirationAfter === undefined,
      before: expirationBefore,
    },
    iteration,
    neverCache: {
      absent: store.get('never-truthy') === undefined && store.get('never-falsy') === undefined,
      falsyCallbackReturnsStore: neverFalsyReturn === store,
      truthyCallbackReturn: neverTruthyReturn,
      withoutCallbackReturnsStore: neverWithoutCallbackReturn === store,
    },
    publicShape: {
      constructorName: MemoryStore.name,
      derivedGetId: derived.get('derived').id,
      derivedInstanceOfBase: derived instanceof MemoryStore,
      lruIdentity: derived.cache instanceof ORM.modules['lru-cache'],
    },
  };
}

function observeModelCache(ORM: Dynamic): Record<string, unknown> {
  const modelCache = ORM.model_cache;
  const configureNull = modelCache.configure(null);
  const configureUndefined = modelCache.configure(undefined);
  ORM.configure({ model_cache: { enabled: false } });
  const Disabled = createType('CacheContractDisabled');
  const disabledResult = modelCache.createCache(Disabled);

  ORM.configure({ model_cache: { enabled: true } });
  const NoOptions = createType('CacheContractNoOptions');
  const noOptionsResult = modelCache.createCache(NoOptions);

  const factoryReceivers: boolean[] = [];
  const customStores: Dynamic[] = [];
  const inheritedModelTypes = Object.create({
    CacheContractPerModel: {
      max: 4,
      store() {
        factoryReceivers.push(this.max === 4);
        const custom = new ORM.MemoryStore({ max: this.max });
        customStores.push(custom);
        return custom;
      },
    },
  });
  const inheritedConfiguration = Object.create({ max: 2 });
  inheritedConfiguration.enabled = true;
  inheritedConfiguration.modelTypes = inheritedModelTypes;
  ORM.configure({ model_cache: inheritedConfiguration });

  const Global = createType('CacheContractGlobal');
  const PerModel = createType('CacheContractPerModel');
  const globalCache = modelCache.createCache(Global);
  const perModelCache = modelCache.createCache(PerModel);
  globalCache.set('a', { id: 'a' });
  globalCache.set('b', { id: 'b' });
  globalCache.set('c', { id: 'c' });
  perModelCache.set('custom', { id: 'custom' });
  const inheritedGlobalCapacity = globalCache.get('a') === undefined && globalCache.get('b')?.id === 'b' && globalCache.get('c')?.id === 'c';
  const oldGlobalCache = globalCache;
  const oldPerModelCache = perModelCache;
  const factoriesBeforeReset = customStores.length;
  const configureReturn = ORM.configure({ model_cache: { enabled: true, max: 1 } });

  const Shared = createType('CacheContractShared');
  Shared.cuid = 'cache-contract-shared-cuid';
  const sharedCache = modelCache.createCache(Shared);
  sharedCache.set('shared', { id: 'shared' });
  const InheritedCuid = createType('CacheContractInheritedCuid');
  Object.setPrototypeOf(InheritedCuid, Shared);
  const inheritedCache = modelCache.createCache(InheritedCuid);

  const Never = createType('CacheContractNever', { _orm_never_cache: true });
  const rawSync = function rawSync() {};
  const neverSync = modelCache.configureSync(Never, rawSync);
  const Wrapped = createType('CacheContractWrapped');
  const wrappedSync = modelCache.configureSync(Wrapped, rawSync);

  return {
    configuration: {
      configureReturnIsArray: Array.isArray(configureReturn),
      configureNullReturnIsArray: Array.isArray(configureNull),
      configureUndefinedReturnIsArray: Array.isArray(configureUndefined),
      disabledCacheIsUndefined: Disabled.cache === undefined,
      disabledResultIsNull: disabledResult === null,
      inheritedGlobalCapacity,
      noOptionsCacheIsUndefined: NoOptions.cache === undefined,
      noOptionsResultIsNull: noOptionsResult === null,
    },
    cuid: {
      inheritedCacheCreated: inheritedCache === InheritedCuid.cache,
      inheritedCuidIsOwn: hasOwn(InheritedCuid, 'cuid'),
      sharedCacheCleared: sharedCache.get('shared') === undefined,
      sharedModelCacheCleared: Shared.cache === null,
    },
    factory: {
      cacheIdentity: oldPerModelCache === customStores[0],
      calledAgainOnReset: customStores.length > factoriesBeforeReset,
      receiverHasPerModelOptions: factoryReceivers.every(Boolean),
    },
    reset: {
      globalChanged: Global.cache !== oldGlobalCache,
      oldGlobalCleared: oldGlobalCache.get('c') === undefined,
      oldPerModelCleared: oldPerModelCache.get('custom') === undefined,
      perModelChanged: PerModel.cache !== oldPerModelCache,
    },
    sync: {
      neverCacheIsUndefined: Never.cache === undefined,
      neverCuidIsUndefined: Never.cuid === undefined,
      neverReturnsRaw: neverSync === rawSync,
      wrappedIsInstalled: Wrapped.prototype.sync === wrappedSync,
      wrappedIsNew: wrappedSync !== rawSync,
    },
  };
}

async function observeModels(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false } });
  const Disabled = Backbone.Model.extend({
    model_name: 'CacheContractDisabledModel',
    schema() {
      return { name: 'String' };
    },
  });
  Disabled.prototype.sync = ORM.sync(Disabled);
  const disabled = new Disabled({ name: 'disabled' });
  await callbackResult((callback) => disabled.save(callback));
  const disabledFound = await callbackResult((callback) => Disabled.find({ id: disabled.id }, callback));

  ORM.configure({ model_cache: { enabled: true, max: 10 } });
  class NativeModel extends Backbone.Model {
    get model_name() {
      return 'CacheContractNativeModel';
    }

    schema() {
      return { name: 'String' };
    }
  }
  const ExtendedModel = Backbone.Model.extend({
    model_name: 'CacheContractExtendedModel',
    schema() {
      return { name: 'String' };
    },
  });
  const NativeModelType: Dynamic = NativeModel;
  NativeModel.prototype.sync = ORM.sync(NativeModel);
  ExtendedModel.prototype.sync = ORM.sync(ExtendedModel);

  const native = new NativeModelType({ name: 'native' });
  const extended = new ExtendedModel({ name: 'extended' });
  await callbackResult((callback) => native.save(callback));
  await callbackResult((callback) => extended.save(callback));
  const nativeFound = await callbackResult((callback) => NativeModel.find({ id: native.id }, callback));
  const fetched = new NativeModelType({ id: native.id });
  await callbackResult((callback) => fetched.fetch(callback));
  const cacheOwnsExtended = ExtendedModel.cache.get(extended.id) === extended;
  const cacheOwnsNative = NativeModel.cache.get(native.id) === native;

  const oldNativeCache = NativeModel.cache;
  ORM.configure({ model_cache: { enabled: true, max: 1 } });
  const reconfiguredNativeCache = NativeModel.cache;
  const afterResetFound = await callbackResult((callback) => NativeModel.find({ id: native.id }, callback));

  return {
    disabled: {
      cacheIsUndefined: Disabled.cache === undefined,
      cuidIsOwn: hasOwn(Disabled, 'cuid'),
      findReturnsDifferentIdentity: disabledFound[0] !== disabled,
    },
    operations: {
      cacheOwnsExtended,
      cacheOwnsNative,
      fetchName: fetched.get('name'),
      findReturnsCachedIdentity: nativeFound[0] === native,
      saveIds: [native.id, extended.id],
    },
    ownership: {
      cachesDistinct: NativeModel.cache !== ExtendedModel.cache,
      cuidsDistinct: NativeModel.cuid !== ExtendedModel.cuid,
      extendedCacheIsOwn: hasOwn(ExtendedModel, 'cache'),
      extendedCuidIsOwn: hasOwn(ExtendedModel, 'cuid'),
      nativeCacheIsOwn: hasOwn(NativeModel, 'cache'),
      nativeCuidIsOwn: hasOwn(NativeModel, 'cuid'),
    },
    reconfigure: {
      cacheChanged: reconfiguredNativeCache !== oldNativeCache,
      findRepopulatesNewCache: reconfiguredNativeCache.get(native.id) === afterResetFound[0],
      oldCacheCleared: oldNativeCache.get(native.id) === undefined,
    },
  };
}

export default async function observeCacheMemoryStore(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  return {
    memoryStore: await observeMemoryStore(ORM),
    modelCache: observeModelCache(ORM),
    models: await observeModels(ORM, Backbone),
    singleton: {
      modelCacheIsExposedRuntimeState: ORM.model_cache && typeof ORM.model_cache.configureSync === 'function',
      modelCacheIsNotPublicConstructor: ORM.ModelCache === undefined,
    },
  };
}
