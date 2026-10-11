import assert from 'assert';

import readConnectionPoolContract from '../lib/readConnectionPoolContract.ts';

describe('ConnectionPool contracts', () => {
  const ownership = {
    additiveMethodsShared: true,
    cacheIdentityPreserved: true,
    disposerCalls: 1,
    entriesPreserved: true,
    ownedDelUsesMemoryStorePrototype: true,
    ownedRemovedAcrossFormats: true,
    poolIdentityShared: true,
    prototypeIdentityPreserved: true,
    runtimeIdentityShared: true,
    synchronousMethodsOwned: false,
    synchronousMethodsShared: true,
    synchronousMethodsStable: true,
  };

  it('preserves the retained synchronous method contract', () => {
    const legacy = readConnectionPoolContract('runLegacyConnectionPoolContract.cjs');
    const candidate = readConnectionPoolContract('runCandidateConnectionPoolContract.cjs');

    assert.deepStrictEqual(candidate, legacy);
    assert.deepStrictEqual(legacy, {
      alias: {
        aliasReturnsPool: true,
        detachedDelError: 'TypeError',
        instanceMethodsDiffer: true,
        prototypeAliasShared: true,
      },
      callbacks: {
        del: [],
        destroy: [],
        get: [null, 'first'],
        missingDestroy: [],
        neverTruthy: [null, 'never'],
        reset: [],
        set: [null, 'first'],
      },
      events: ['before-set', 'set-callback', 'after-set', 'get-callback', 'after-get', 'destroy-callback', 'after-destroy', 'reset-callback', 'after-reset'],
      iteration: [
        { cacheIdentity: true, id: 'b', key: 'iteration-b' },
        { cacheIdentity: true, id: 'a', key: 'iteration-a' },
        { cacheIdentity: true, id: 'replacement', key: 'first' },
      ],
      legacyDisposal: { firstDestroyCalls: 0, replacementDestroyCalls: 0 },
      neverCache: { absent: true, falsyReturnsPool: true, truthyReturn: 'never-result' },
      returns: {
        destroyReturnsPool: true,
        detachedValueId: 'detached',
        forEachIsUndefined: true,
        getReturnsValue: true,
        missingDestroyReturnsPool: true,
        replacementReturnsPool: true,
        resetReturnsPool: true,
        setReturnsPool: true,
      },
    });
  });

  for (const mode of ['cjs-first', 'esm-first'] as const) {
    it(`keeps owned synchronous methods stable through public package entries with ${mode}`, () => {
      assert.deepStrictEqual(readConnectionPoolContract('runPublicConnectionPoolOwnership.cjs', mode), ownership);
    });
  }
});
