import assert from 'assert';

import { preservedPublicRuntimeState } from '../lib/publicRuntimeAdoptionScenario.ts';
import readJSONUtilsContract from '../lib/readJSONUtilsContract.ts';

describe('JSONUtils contracts', () => {
  it('matches retained parsing, cloning, callbacks, returns, errors, and ordering', () => {
    assert.deepStrictEqual(readJSONUtilsContract('runCandidateJSONUtilsContract.cjs'), readJSONUtilsContract('runLegacyJSONUtilsContract.cjs'));
  });

  for (const order of ['root-first', 'umd-first']) {
    it(`shares owned JSONUtils and populated state through public entries ${order}`, () => {
      assert.deepStrictEqual(readJSONUtilsContract('runCandidateJSONUtilsOwnership.cjs', order), {
        implementationsShared: true,
        jsonUtilsOwned: true,
        singletonPreserved: true,
        statePreserved: preservedPublicRuntimeState,
      });
    });
  }
});
