type Dynamic = any;

export interface CacheUpgradeState {
  connectionPool: Dynamic;
  customFactoryCalls: number;
  customFactoryReceiver: boolean;
  customStore: Dynamic;
  firstEntry?: {
    MemoryStore: Dynamic;
    configure: Dynamic;
    configureSync: Dynamic;
    createCache: Dynamic;
    reset: Dynamic;
  };
  legacyCache: Dynamic;
  legacyCacheSyncConstructor: Dynamic;
  legacyWrappedSync: Dynamic;
  modelCache: Dynamic;
  modelCacheConstructor: Dynamic;
  options: Dynamic;
  populatedType: Dynamic;
  retainedMemoryStore: Dynamic;
  retainedMethods: {
    configure: Dynamic;
    configureSync: Dynamic;
    createCache: Dynamic;
    reset: Dynamic;
  };
}

export function prepareCacheUpgradeState(retained: Dynamic, suffix: string): CacheUpgradeState {
  const modelCache = retained.model_cache;
  const retainedMemoryStore = retained.MemoryStore;
  const customStore = new retainedMemoryStore({ max: 10 });
  const populatedName = `CacheUpgradePopulated${suffix}`;
  const state: CacheUpgradeState = {
    connectionPool: retained.ConnectionPool,
    customFactoryCalls: 0,
    customFactoryReceiver: false,
    customStore,
    legacyCache: undefined,
    legacyCacheSyncConstructor: undefined,
    legacyWrappedSync: undefined,
    modelCache,
    modelCacheConstructor: Object.getPrototypeOf(modelCache).constructor,
    options: undefined,
    populatedType: undefined,
    retainedMemoryStore,
    retainedMethods: {
      configure: modelCache.configure,
      configureSync: modelCache.configureSync,
      createCache: modelCache.createCache,
      reset: modelCache.reset,
    },
  };
  const perModelOptions = {
    max: 10,
    store() {
      state.customFactoryCalls += 1;
      state.customFactoryReceiver = this === perModelOptions;
      return customStore;
    },
  };

  retained.configure({ model_cache: { enabled: true, max: 10, modelTypes: { [populatedName]: perModelOptions } } });
  function PopulatedType() {}
  PopulatedType.model_name = populatedName;
  state.populatedType = PopulatedType;
  state.options = modelCache.options;
  modelCache.createCache(PopulatedType);
  customStore.set('before-install', { id: 'before-install' });

  const LegacyWrappedType: Dynamic = function LegacyWrappedType() {};
  LegacyWrappedType.model_name = `CacheUpgradeLegacyWrapped${suffix}`;
  const rawSync = (method: string) => (method === 'initialize' ? undefined : method);
  const legacyWrappedSync = modelCache.configureSync(LegacyWrappedType, rawSync);
  const legacyCache = LegacyWrappedType.cache;
  legacyCache.set('legacy-wrapper', { id: 'legacy-wrapper' });
  state.legacyCache = legacyCache;
  state.legacyCacheSyncConstructor = legacyWrappedSync('sync').constructor;
  state.legacyWrappedSync = legacyWrappedSync;
  return state;
}

export function captureFirstCacheEntry(state: CacheUpgradeState, runtime: Dynamic): void {
  state.firstEntry = {
    MemoryStore: runtime.MemoryStore,
    configure: runtime.model_cache.configure,
    configureSync: runtime.model_cache.configureSync,
    createCache: runtime.model_cache.createCache,
    reset: runtime.model_cache.reset,
  };
}

export function observeCacheUpgrade(state: CacheUpgradeState, runtime: Dynamic): Record<string, unknown> {
  function OwnedWrappedType() {}
  OwnedWrappedType.model_name = 'CacheUpgradeOwnedWrapped';
  const rawSync = (method: string) => (method === 'initialize' ? undefined : method);
  const ownedWrappedSync = runtime.model_cache.configureSync(OwnedWrappedType, rawSync);
  const firstEntry = state.firstEntry;

  return {
    connectionPoolIdentityPreserved: runtime.ConnectionPool === state.connectionPool,
    connectionPoolRetainsExistingStore: state.connectionPool instanceof state.retainedMemoryStore,
    customCacheDataPreserved: state.customStore.get('before-install')?.id,
    customCacheIdentityPreserved: state.populatedType.cache === state.customStore,
    customFactoryCalls: state.customFactoryCalls,
    customFactoryReceiver: state.customFactoryReceiver,
    legacyCacheDataPreserved: state.legacyCache.get('legacy-wrapper')?.id,
    legacyCacheIdentityPreserved: state.legacyWrappedSync('sync').model_type.cache === state.legacyCache,
    memoryStoreOwned: runtime.MemoryStore !== state.retainedMemoryStore,
    modelCacheIdentityPreserved: runtime.model_cache === state.modelCache,
    modelCacheMethodsOwned: Object.entries(state.retainedMethods).every(([key, method]) => runtime.model_cache[key] !== method),
    modelCachePrototypeOwned: Object.getPrototypeOf(runtime.model_cache).constructor !== state.modelCacheConstructor,
    newCacheSyncOwned: ownedWrappedSync('sync').constructor !== state.legacyCacheSyncConstructor,
    optionsIdentityPreserved: runtime.model_cache.options === state.options,
    sharedGuardPreservesFirstEntry: Boolean(
      firstEntry &&
        firstEntry.MemoryStore === runtime.MemoryStore &&
        firstEntry.configure === runtime.model_cache.configure &&
        firstEntry.configureSync === runtime.model_cache.configureSync &&
        firstEntry.createCache === runtime.model_cache.createCache &&
        firstEntry.reset === runtime.model_cache.reset
    ),
  };
}
