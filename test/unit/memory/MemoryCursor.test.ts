import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

import { observePublishedCursorContract } from '../../lib/publicContractObservations.ts';

describe('MemoryCursor', () => {
  const readCandidate = () => observePublishedCursorContract(ORM, Backbone);

  it('matches object equality', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(queryResults.objectIds, [1]);
  });

  it('matches nested equality', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(queryResults.nestedIds, [1]);
  });

  it('matches Date equality', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(queryResults.dateIds, [1]);
  });

  it('requires every comparison operator to match', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(queryResults.combinedIds, [1]);
  });

  it('preserves membership, existence, ids, count, sort, limit, and zero queries', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(
      {
        count: queryResults.count,
        existsFalse: queryResults.existsFalse,
        existsIds: queryResults.existsIds,
        existsTrue: queryResults.existsTrue,
        ids: queryResults.ids,
        inIds: queryResults.inIds,
        missingIds: queryResults.missingIds,
        neIds: queryResults.neIds,
        ninIds: queryResults.ninIds,
        sortedLimitedIds: queryResults.sortedLimitedIds,
        zero: queryResults.zero,
        zeroOne: queryResults.zeroOne,
      },
      {
        count: 2,
        existsFalse: false,
        existsIds: [1, 2],
        existsTrue: true,
        ids: [2],
        inIds: [2],
        missingIds: [1, 2],
        neIds: [2],
        ninIds: [1],
        sortedLimitedIds: [2],
        zero: [],
        zeroOne: null,
      }
    );
  });

  it('translates direct relation id and related-model queries', async () => {
    const relations = (await readCandidate()).relations as { cacheOff: Record<string, unknown>; cacheOn: Record<string, unknown> };
    assert.deepStrictEqual(relations.cacheOff.relationIdQueryIds, [10, 11]);
    assert.deepStrictEqual(relations.cacheOff.relationQueryIds, [1]);
    assert.deepStrictEqual(relations.cacheOn.relationIdQueryIds, [10, 11]);
    assert.deepStrictEqual(relations.cacheOn.relationQueryIds, [1]);
  });

  it('loads empty, one-row, and large real relation includes without growing the stack', async () => {
    assert.deepStrictEqual((await readCandidate()).includeBoundaries, {
      emptyLength: 0,
      largeFirstAuthor: 'Boundary Author',
      largeLastAuthor: 'Boundary Author',
      largeLength: 2500,
      oneAuthor: 'Boundary Author',
      oneLength: 1,
    });
  });

  it('counts unique rows before reporting a page total', async () => {
    const queryResults = (await readCandidate()).queryResults as Record<string, unknown>;
    assert.deepStrictEqual(queryResults.uniquePage, {
      offset: 0,
      rows: [
        {
          a: 1,
          b: 'first',
          details: { name: 'first' },
          group: 'same',
          id: 1,
          name: 'alpha',
          stamp: new Date('2020-01-01T00:00:00.000Z'),
        },
      ],
      total_rows: 1,
    });
  });
});
