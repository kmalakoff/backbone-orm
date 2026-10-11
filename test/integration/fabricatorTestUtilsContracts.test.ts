import assert from 'assert';

import { preservedPublicRuntimeState } from '../lib/publicRuntimeAdoptionScenario.ts';
import readFabricatorTestUtilsContract from '../lib/readFabricatorTestUtilsContract.ts';

describe('Fabricator and TestUtils retained contracts', () => {
  it('matches retained values, callbacks, returns, errors, overloads, and fresh option sets', () => {
    const legacy = readFabricatorTestUtilsContract('runLegacyFabricatorTestUtils.cjs');
    const candidate = readFabricatorTestUtilsContract('runCandidateFabricatorTestUtils.cjs');
    assert.deepStrictEqual(candidate, legacy);
  });

  for (const order of ['root-first', 'umd-first']) {
    it(`shares owned helpers and populated state through public entries ${order}`, () => {
      assert.deepStrictEqual(readFabricatorTestUtilsContract('runCandidateFabricationOwnership.cjs', order), {
        fabricatorOwned: true,
        runtimePreserved: true,
        singletonFabricator: true,
        singletonRuntime: true,
        singletonTestUtils: true,
        statePreserved: preservedPublicRuntimeState,
        testUtilsOwned: true,
      });
    });
  }
});
