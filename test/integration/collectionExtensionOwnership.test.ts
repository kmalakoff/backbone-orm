import assert from 'assert';

import readModelExtensionContract from '../lib/readModelExtensionContract.ts';

describe('collection extension ownership', () => {
  it('installs the owned methods on a cold public Node entry', () => {
    assert.deepStrictEqual(readModelExtensionContract('runPublicCollectionExtensionOwnership.cjs'), {
      boundaryAbsentAfterLoad: true,
      fetchInstalledByConfigure: true,
      originalsCapturePriorFetch: true,
      originalsCapturePriorPrepareModel: true,
      prepareModelInstalledByConfigure: true,
      rootLoadPreservedBackboneMethods: true,
      runtimeBackboneIdentity: true,
    });
  });
});
