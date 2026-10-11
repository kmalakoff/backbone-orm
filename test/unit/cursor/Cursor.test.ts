import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

import cursorDataPropertyAssertions from '../../lib/cursorDataPropertyAssertions.ts';
import { observePublishedCursorContract } from '../../lib/publicContractObservations.ts';

describe('Cursor', () => {
  const readCandidate = () => observePublishedCursorContract(ORM, Backbone);

  describe('own query data', () => {
    cursorDataPropertyAssertions(() => ORM, 'NodeCursorDataProperty');
  });

  it('owns the static query validator', async () => {
    const staticMethods = (await readCandidate()).staticMethods as Record<string, unknown>;
    assert.strictEqual(staticMethods.validateQuery, 'function');
  });

  it('inherits the static query parser on the concrete cursor', async () => {
    const staticMethods = (await readCandidate()).staticMethods as Record<string, unknown>;
    assert.strictEqual(staticMethods.parseQuery, 'function');
    assert.strictEqual(staticMethods.inheritedParseQuery, 'function');
  });

  it('preserves falsy and scalar parser behavior', async () => {
    const candidate = await readCandidate();
    assert.deepStrictEqual(candidate.falsyParsing, [
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
      { cursor: {}, find: {} },
    ]);
    assert.deepStrictEqual(candidate.scalarParsing, { cursor: { $one: true }, find: { id: 7 } });
    assert.strictEqual(candidate.undefinedRejected, true);
  });

  it('recursively rejects undefined values in arrays', async () => {
    const candidate = await readCandidate();
    assert.strictEqual(candidate.undefinedInArrayRejected, true);
    assert.strictEqual(candidate.undefinedInNestedArrayRejected, true);
  });

  it('preserves non-plain object parser behavior', async () => {
    assert.deepStrictEqual((await readCandidate()).nonPlainParsing, {
      date: { cursor: {}, find: {} },
      function: { cursor: {}, find: {} },
    });
  });

  it('preserves callable construction and dynamic dispatch', async () => {
    const candidate = await readCandidate();
    assert.deepStrictEqual(candidate.constructorRoles, {
      baseHasBuildFindQuery: 'undefined',
      concreteHasBuildFindQuery: 'function',
      distinct: true,
      inherited: true,
    });
    assert.deepStrictEqual(candidate.adapter, {
      instanceOfConcrete: true,
      returnValue: 'adapter-callback-return',
    });
    assert.strictEqual(candidate.adapterValue, 'adapter-owned-result');
  });

  it('preserves callback error delivery, returns, and thrown exceptions', async () => {
    const candidate = await readCandidate();
    assert.strictEqual(candidate.adapterErrorMessage, 'adapter-owned-error');
    assert.deepStrictEqual(candidate.dispatchErrors, {
      callbackCount: 1,
      callbackReturn: 'error-callback-return',
      callbackThrowsThrough: true,
    });
  });

  it('flattens modifiers and preserves selection shapes', async () => {
    const candidate = await readCandidate();
    assert.deepStrictEqual(candidate.chainedModifiers, {
      select: ['a', 'name'],
      values: ['a', 'b'],
      whitelist: ['a', 'name'],
    });
    assert.deepStrictEqual(candidate.selections, {
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
  });

  it('restores count and exists flags with callback returns', async () => {
    const candidate = await readCandidate();
    assert.deepStrictEqual(candidate.flagRestoration, {
      after: { count: 'prior-count', exists: '' },
      countReturn: 'count-callback-return',
      during: [
        { count: true, exists: '' },
        { count: 'prior-count', exists: true },
      ],
      existsReturn: 'exists-callback-return',
    });
  });

  it('returns one model for a matching one query', async () => {
    const materialization = (await readCandidate()).materialization as Record<string, unknown>;
    assert.strictEqual(materialization.oneIsModel, true);
    assert.strictEqual(materialization.oneModelId, 1);
  });

  it('returns null for a missing one query', async () => {
    const materialization = (await readCandidate()).materialization as Record<string, unknown>;
    assert.strictEqual(materialization.missingOneIsNull, true);
  });

  it('returns arrays for empty and many queries', async () => {
    const materialization = (await readCandidate()).materialization as Record<string, unknown>;
    assert.strictEqual(materialization.emptyLength, 0);
    assert.deepStrictEqual(materialization.manyIds, [1, 2]);
  });

  it('parses partial models before marking them partial', async () => {
    const materialization = (await readCandidate()).materialization as Record<string, unknown>;
    assert.strictEqual(materialization.partialIsPartial, true);
    assert.strictEqual(materialization.partialParsedName, 'ALPHA');
  });
});
