import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

import { observePublishedRelationOperations, observePublishedSchemaRelationContract } from '../../lib/publicContractObservations.ts';

describe('Relation', () => {
  it('owns reverse pointers, foreign keys, and virtual accessors', async () => {
    const cycle = (await observePublishedSchemaRelationContract(ORM, Backbone)).cycle as Record<string, unknown>;
    assert.strictEqual(cycle.reversePointerShared, true);
    assert.strictEqual(cycle.reverseRelationLookup, 'books');
    assert.deepStrictEqual(cycle.relation, {
      embed: false,
      foreignKey: 'author_id',
      joinKey: 'schema_cycle_author_id',
      key: 'books',
      manualFetch: false,
      reverseKey: 'author',
      type: 'hasMany',
      virtual: false,
      virtualIdAccessor: 'book_ids',
    });
  });

  it('owns count, paging, and virtual-id cursors', async () => {
    assert.deepStrictEqual((await observePublishedRelationOperations(ORM, Backbone)).cursor, {
      count: 3,
      idValues: [1, 2, 3],
      page: [{ id: 2, rank: 2 }],
    });
  });

  it('preserves join fallback and the relation(undefined) override hook', async () => {
    const boundaries = (await observePublishedSchemaRelationContract(ORM, Backbone)).translationBoundaries as Record<string, unknown>;
    assert.strictEqual(boundaries.joinFallback, true);
    assert.deepStrictEqual(boundaries.reverseOverride, {
      firstCall: { argumentCount: 1, key: null },
      usedOverride: true,
    });
  });
});
