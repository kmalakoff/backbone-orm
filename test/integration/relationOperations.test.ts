import assert from 'assert';

import { readRelationOperations } from '../lib/readRelationOperations.ts';

const manyCallback = {
  argumentCount: 1,
  error: null,
  receiverIsUndefined: true,
  returned: null,
};

function manyCase(ids: number[], loaded: boolean): Record<string, unknown> {
  return {
    addCallback: manyCallback,
    afterAdd: { collectionIds: ids, linkedIds: ids, loaded },
    afterRemove: { collectionIds: [], linkedIds: [] },
    removeCallback: manyCallback,
  };
}

function oneCase(id: number, loaded: boolean): Record<string, unknown> {
  return {
    addCallback: {
      argumentCount: 1,
      error: null,
      receiverIsUndefined: false,
      returned: null,
    },
    afterAdd: { loaded, profileId: id, storedOwnerId: id },
    afterRemove: { profile: null, storedOwnerId: null },
    removeCallback: {
      argumentCount: 4,
      error: null,
      receiverIsUndefined: true,
      returned: null,
    },
  };
}

describe('owned relation operation contracts', () => {
  let legacy: Record<string, unknown> | undefined;
  let candidate: Record<string, unknown> | undefined;
  const readLegacy = () => (legacy ??= readRelationOperations('runLegacyRelationOperations.cjs'));
  const readCandidate = () => (candidate ??= readRelationOperations('runCandidateRelationOperations.cjs'));

  it('pins relation input, collection, cursor, callback, and field behavior independently', () => {
    const legacy = readLegacy();
    assert.deepStrictEqual(legacy.collectionLifecycle, {
      afterAdd: [true, true],
      afterManyRelease: { collectionLength: 1, parentOrmMissing: true },
      afterOneRelease: {
        oldBacklinkRetained: true,
        ormMissing: false,
        profileAfterRelease: 2,
        replacementBacklinkInstalled: false,
      },
      afterRemove: [null, true],
      afterReset: [true, null, [1]],
    });
    assert.deepStrictEqual(legacy.cursor, {
      count: 3,
      idValues: [1, 2, 3],
      page: [{ id: 2, rank: 2 }],
    });
    assert.deepStrictEqual(legacy.manyPatchInputs, {
      'loaded-array': manyCase([22, 23, 24], false),
      'loaded-id': manyCase([13], false),
      'loaded-json': manyCase([16], true),
      'loaded-model': manyCase([19], true),
      'unloaded-array': manyCase([10, 11, 12], false),
      'unloaded-id': manyCase([1], false),
      'unloaded-json': manyCase([4], false),
      'unloaded-model': manyCase([7], false),
    });
    assert.deepStrictEqual(legacy.onePatchInputs, {
      arrayError: {
        argumentCount: 1,
        error: 'One.patchAdd: should be provided with one model only for key: profile',
        receiverIsUndefined: true,
        returned: 'operation-callback-return',
      },
      'loaded-id': oneCase(4, false),
      'loaded-json': oneCase(5, false),
      'loaded-model': oneCase(6, true),
      missingError: {
        argumentCount: 1,
        error: "patchAdd: missing relateds for 'profile'",
        receiverIsUndefined: true,
        returned: 'operation-callback-return',
      },
      'unloaded-id': oneCase(1, false),
      'unloaded-json': oneCase(2, false),
      'unloaded-model': oneCase(3, true),
    });
    assert.deepStrictEqual(legacy.unsupportedFields, {
      nonString: 'Unexpected type name is not a string: {"type":7}',
      tooMany: 'Unexpected field options array: [{},{}]',
      unknownString: { type: 'CustomScalar' },
    });
  });

  it('requires the owned candidate to match the isolated retained operations', () => {
    assert.deepStrictEqual(readCandidate(), readLegacy());
  });
});
