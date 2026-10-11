import assert from 'assert';

import readDatabaseFoundationContract from '../lib/readDatabaseFoundationContract.ts';

describe('preconfigured DatabaseURL and naming installation', () => {
  for (const mode of ['camelize', 'custom']) {
    it(`preserves a populated ${mode} runtime through public CJS and ESM entries`, () => {
      const observation = readDatabaseFoundationContract('runPublicPreconfiguredDatabaseFoundation.cjs', mode);
      assert.deepStrictEqual(observation.commonJS, {
        ...observation.before,
        markerPreserved: true,
        namingPreserved: true,
        newModelName: observation.before.liveModelName,
        runtimePreserved: true,
      });
      assert.deepStrictEqual(observation.esm, observation.commonJS);
      assert.strictEqual(observation.runtimesShared, true);
    });
  }
});
