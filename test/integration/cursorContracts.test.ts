import assert from 'assert';

import { readCursorContract } from '../lib/readCursorContract.ts';

describe('legacy and candidate cursor contracts', () => {
  let legacy: Record<string, unknown> | undefined;
  let candidate: Record<string, unknown> | undefined;
  const readLegacy = () => (legacy ??= readCursorContract('runLegacyCursorContract.cjs'));
  const readCandidate = () => (candidate ??= readCursorContract('runCandidateCursorContract.cjs'));

  it('pins the retained implementation to independent expectations', () => {
    const legacy = readLegacy();
    assert.deepStrictEqual(legacy.constructorRoles, {
      baseHasBuildFindQuery: 'undefined',
      concreteHasBuildFindQuery: 'function',
      distinct: true,
      inherited: true,
    });
    assert.deepStrictEqual(legacy.staticMethods, {
      inheritedParseQuery: 'function',
      parseQuery: 'function',
      validateQuery: 'function',
    });
    assert.deepStrictEqual(legacy.baseMethods, {
      execWithCursorQuery: 'function',
      prepareIncludes: 'function',
      queryToJSON: 'function',
      relatedModelTypesInQuery: 'function',
      selectFromModels: 'function',
    });
    assert.deepStrictEqual(legacy.falsyParsing, [
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
    ]);
    assert.deepStrictEqual(legacy.scalarParsing, { cursor: { $one: true }, find: { id: 7 } });
    assert.strictEqual(legacy.undefinedRejected, true);
    assert.strictEqual(legacy.undefinedInArrayRejected, true);
    assert.strictEqual(legacy.undefinedInNestedArrayRejected, true);
    assert.deepStrictEqual(legacy.nonPlainParsing, {
      date: { cursor: {}, find: {} },
      function: { cursor: {}, find: {} },
    });
    assert.deepStrictEqual(legacy.chainedModifiers, {
      select: ['a', 'name'],
      values: ['a', 'b'],
      whitelist: ['a', 'name'],
    });
    assert.deepStrictEqual(legacy.selections, {
      pageValues: [
        [1, 'first'],
        [2, 'second'],
      ],
      selected: [{ b: 'first' }, { b: 'second' }],
      singleOneValue: 1,
      values: [
        [1, 'first'],
        [2, 'second'],
      ],
    });
    assert.deepStrictEqual(legacy.adapter, {
      instanceOfConcrete: true,
      returnValue: 'adapter-callback-return',
    });
    assert.strictEqual(legacy.adapterValue, 'adapter-owned-result');
    assert.strictEqual(legacy.adapterErrorMessage, 'adapter-owned-error');
    assert.deepStrictEqual(legacy.dispatchErrors, {
      callbackCount: 1,
      callbackReturn: 'error-callback-return',
      callbackThrowsThrough: true,
    });
    assert.deepStrictEqual(legacy.flagRestoration, {
      after: { count: 'prior-count', exists: '' },
      countReturn: 'count-callback-return',
      during: [
        { count: true, exists: '' },
        { count: 'prior-count', exists: true },
      ],
      existsReturn: 'exists-callback-return',
    });
    assert.deepStrictEqual(legacy.queryResults, {
      combinedIds: [1],
      count: 2,
      dateIds: [1],
      existsFalse: false,
      existsIds: [1, 2],
      existsTrue: true,
      ids: [2],
      inIds: [2],
      missingIds: [1, 2],
      neIds: [2],
      nestedIds: [1],
      ninIds: [1],
      objectIds: [1],
      page: {
        offset: 1,
        rows: [
          {
            a: 2,
            b: 'second',
            details: { name: 'second' },
            group: 'same',
            id: 2,
            name: 'beta',
            stamp: '2021-01-01T00:00:00.000Z',
          },
        ],
        total_rows: 2,
      },
      sortedLimitedIds: [2],
      uniquePage: {
        offset: 0,
        rows: [
          {
            a: 1,
            b: 'first',
            details: { name: 'first' },
            group: 'same',
            id: 1,
            name: 'alpha',
            stamp: '2020-01-01T00:00:00.000Z',
          },
        ],
        total_rows: 1,
      },
      zero: [],
      zeroOne: null,
    });
    assert.deepStrictEqual(legacy.materialization, {
      emptyLength: 0,
      manyIds: [1, 2],
      missingOneIsNull: true,
      oneIsModel: true,
      oneModelId: 1,
      partialIsPartial: true,
      partialParsedName: 'ALPHA',
    });
    assert.deepStrictEqual(legacy.includeBoundaries, {
      emptyLength: 0,
      largeFirstAuthor: 'Boundary Author',
      largeLastAuthor: 'Boundary Author',
      largeLength: 2500,
      oneAuthor: 'Boundary Author',
      oneLength: 1,
    });
    assert.deepStrictEqual(legacy.relations, {
      cacheOff: {
        cacheHasIncludedAuthor: true,
        includedJSONIsPlain: true,
        materializedAuthorsAreModels: true,
        relationIdQueryIds: [10, 11],
        relationQueryIds: [1],
        repeatedAuthorIdentity: false,
        sharedAuthorIdentity: false,
      },
      cacheOn: {
        cacheHasIncludedAuthor: true,
        includedJSONIsPlain: true,
        materializedAuthorsAreModels: true,
        relationIdQueryIds: [10, 11],
        relationQueryIds: [1],
        repeatedAuthorIdentity: true,
        sharedAuthorIdentity: true,
      },
    });
    assert.deepStrictEqual(legacy.cache, {
      cachedIdentity: true,
      connectClearedCache: true,
      deleteClearedCache: true,
      forcedReadName: 'stored',
      ordinaryReadName: 'cached',
      resetClearedBoth: true,
      updatedName: 'updated',
      updateKeptIdentity: true,
    });
    assert.deepStrictEqual(legacy.cacheErrors, {
      create: {
        argumentMessages: ['Create should not be called for a manual id. Set an id before calling save. Model name: CursorContractManualErrorModel. Model: {"name":"missing-id"}'],
        omittedHandlerReturnIsUndefined: true,
        receiverIsOptions: true,
        returned: 'create-error-return',
      },
      update: {
        argumentMessages: ['Update cannot create a new model without manual option. Set an id before calling save. Model name: CursorContractAutomaticErrorModel. Model: {"id":404,"name":"missing"}'],
        omittedHandlerReturnIsUndefined: true,
        receiverIsOptions: true,
        returned: 'update-error-return',
      },
    });
    assert.deepStrictEqual(legacy.cachePolicy, {
      cacheCursorParseQuery: 'function',
      connectOrder: ['reset', 'connect'],
      destroyQuery: {
        $each: { limit: 1000, threads: 100 },
        group: 'remove',
      },
    });
  });

  it('requires the candidate to match the isolated retained implementation', () => {
    const { cachePolicy: retainedPolicy, ...retained } = readLegacy();
    const { cachePolicy, ...candidate } = readCandidate();
    assert.deepStrictEqual(candidate, retained);
    const { destroyQuery: _retainedDestroyQuery, ...unchangedPolicy } = retainedPolicy as Record<string, unknown>;
    assert.deepStrictEqual(cachePolicy, unchangedPolicy);
  });
});
