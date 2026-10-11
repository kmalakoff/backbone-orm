import assert from 'assert';

import { readCacheMemoryStoreContract } from '../lib/readCacheMemoryStoreContract.ts';

describe('legacy and candidate cache/MemoryStore contracts', () => {
  let legacy: Record<string, unknown> | undefined;
  let candidate: Record<string, unknown> | undefined;
  const readLegacy = () => (legacy ??= readCacheMemoryStoreContract('runLegacyCacheMemoryStoreContract.cjs'));
  const readCandidate = () => (candidate ??= readCacheMemoryStoreContract('runCandidateCacheMemoryStoreContract.cjs'));

  it('pins public MemoryStore behavior to independent expectations', () => {
    assert.deepStrictEqual(readLegacy().memoryStore, {
      alias: {
        aliasReturnsStore: true,
        detachedDelError: 'TypeError',
        destroyIsOwn: true,
        instanceMethodsDiffer: true,
        prototypeAliasShared: true,
      },
      bound: {
        destroyReturnsStore: true,
        detachedGetId: 3,
        detachedValueRemoved: true,
        forEachReturnIsUndefined: true,
        getReturnsValue: true,
        resetReturnsStore: true,
        setReturnsStore: true,
      },
      callbacks: {
        del: [],
        destroy: [],
        get: [null, 1],
        neverTruthy: [null, 6],
        reset: [],
        set: [null, 1],
      },
      defaults: {
        nullCacheUsesBundledLRU: true,
        nullGetId: 'null-options',
        undefinedCacheUsesBundledLRU: true,
        undefinedGetId: 'undefined-options',
      },
      callable: {
        cacheUsesBundledLRU: true,
        getId: 'callable',
        returnIsUndefined: true,
      },
      capacity: {
        a: 'a',
        bIsEvicted: true,
        c: 'c',
      },
      expiration: {
        afterIsUndefined: true,
        before: 'expiring',
      },
      iteration: [
        { cacheIsLRU: true, id: 5, key: 'iteration-b' },
        { cacheIsLRU: true, id: 4, key: 'iteration-a' },
        { cacheIsLRU: true, id: 1, key: 'first' },
      ],
      neverCache: {
        absent: true,
        falsyCallbackReturnsStore: true,
        truthyCallbackReturn: 'never-callback-return',
        withoutCallbackReturnsStore: true,
      },
      publicShape: {
        constructorName: 'MemoryStore',
        derivedGetId: 'derived',
        derivedInstanceOfBase: true,
        lruIdentity: true,
      },
    });
  });

  it('pins singleton ModelCache configuration and wrapper behavior', () => {
    assert.deepStrictEqual(readLegacy().modelCache, {
      configuration: {
        configureReturnIsArray: true,
        configureNullReturnIsArray: true,
        configureUndefinedReturnIsArray: true,
        disabledCacheIsUndefined: true,
        disabledResultIsNull: true,
        inheritedGlobalCapacity: true,
        noOptionsCacheIsUndefined: true,
        noOptionsResultIsNull: true,
      },
      cuid: {
        inheritedCacheCreated: true,
        inheritedCuidIsOwn: false,
        sharedCacheCleared: true,
        sharedModelCacheCleared: true,
      },
      factory: {
        cacheIdentity: true,
        calledAgainOnReset: true,
        receiverHasPerModelOptions: true,
      },
      reset: {
        globalChanged: true,
        oldGlobalCleared: true,
        oldPerModelCleared: true,
        perModelChanged: true,
      },
      sync: {
        neverCacheIsUndefined: true,
        neverCuidIsUndefined: true,
        neverReturnsRaw: true,
        wrappedIsInstalled: true,
        wrappedIsNew: true,
      },
    });
  });

  it('pins real disabled, cached, and reconfigured model behavior', () => {
    assert.deepStrictEqual(readLegacy().models, {
      disabled: {
        cacheIsUndefined: true,
        cuidIsOwn: true,
        findReturnsDifferentIdentity: true,
      },
      operations: {
        cacheOwnsExtended: true,
        cacheOwnsNative: true,
        fetchName: 'native',
        findReturnsCachedIdentity: true,
        saveIds: [1, 1],
      },
      ownership: {
        cachesDistinct: true,
        cuidsDistinct: true,
        extendedCacheIsOwn: true,
        extendedCuidIsOwn: true,
        nativeCacheIsOwn: true,
        nativeCuidIsOwn: true,
      },
      reconfigure: {
        cacheChanged: true,
        findRepopulatesNewCache: true,
        oldCacheCleared: true,
      },
    });
    assert.deepStrictEqual(readLegacy().singleton, {
      modelCacheIsExposedRuntimeState: true,
      modelCacheIsNotPublicConstructor: true,
    });
  });

  it('requires the current candidate bridge to match the retained implementation', () => {
    assert.deepStrictEqual(readCandidate(), readLegacy());
  });
});
