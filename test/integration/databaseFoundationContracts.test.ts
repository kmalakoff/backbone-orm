import assert from 'assert';

import { preservedPublicRuntimeState } from '../lib/publicRuntimeAdoptionScenario.ts';
import readDatabaseFoundationContract from '../lib/readDatabaseFoundationContract.ts';

describe('DatabaseURL and naming foundation contracts', () => {
  it('preserves retained contracts apart from the explicitly corrected multi-host href', () => {
    const legacy = readDatabaseFoundationContract('runLegacyDatabaseFoundationContract.cjs');
    const candidate = readDatabaseFoundationContract('runCandidateDatabaseFoundationContract.cjs');
    type URLObservations = Record<string, { fields: Record<string, unknown>; [key: string]: unknown }>;
    const { urls: legacyURLsValue, ...legacyOther } = legacy;
    const { urls: candidateURLsValue, ...candidateOther } = candidate;
    const { multiple: legacyMultiple, ...legacyOtherURLs } = legacyURLsValue as URLObservations;
    const { multiple: candidateMultiple, ...candidateOtherURLs } = candidateURLsValue as URLObservations;
    const { href: legacyHref, ...legacyFields } = legacyMultiple.fields;
    const { href: candidateHref, ...candidateFields } = candidateMultiple.fields;
    assert.strictEqual(legacyHref, 'string:protocol://user:password@host1:83/:81,host2:82,host3/database/model_names?query1=true&query2=%22bob%22');
    assert.strictEqual(candidateHref, 'string:protocol://user:password@host1:81,host2:82,host3:83/database/model_names?query1=true&query2=%22bob%22');
    assert.deepStrictEqual({ ...candidateMultiple, fields: candidateFields }, { ...legacyMultiple, fields: legacyFields });
    assert.deepStrictEqual(candidateOtherURLs, legacyOtherURLs);
    assert.deepStrictEqual(candidateOther, legacyOther);
  });

  for (const order of ['root-first', 'umd-first']) {
    it(`shares owned foundation implementations and populated state through public entries ${order}`, () => {
      assert.deepStrictEqual(readDatabaseFoundationContract('runCandidateDatabaseFoundationOwnership.cjs', order), {
        baseConventionOwned: true,
        configureOwned: true,
        databaseURLOwned: true,
        findOrGenerateModelNameOwned: true,
        implementationsShared: true,
        singletonPreserved: true,
        statePreserved: preservedPublicRuntimeState,
      });
    });

    for (const mode of ['camelize', 'custom']) {
      it(`matches retained preconfigured ${mode} state through public entries ${order}`, () => {
        assert.deepStrictEqual(readDatabaseFoundationContract('runCandidatePreconfiguredDatabaseFoundation.cjs', mode, order), {
          observation: readDatabaseFoundationContract('runLegacyPreconfiguredDatabaseFoundation.cjs', mode),
          publicEntriesShared: true,
          publicMarkerPreserved: true,
          publicNamingPreserved: true,
        });
      });
    }
  }
});
