import assert from 'assert';

import readModelExtensionContract from '../lib/readModelExtensionContract.ts';

describe('Utils, model, and collection retained contracts', () => {
  it('matches retained callbacks, returns, errors, ordering, batching, streams, intervals, and cache identity', () => {
    const legacy = readModelExtensionContract('runLegacyModelExtensionContract.cjs');
    const candidate = readModelExtensionContract('runCandidateModelExtensionContract.cjs');
    assert.deepStrictEqual(candidate, legacy);
  });

  it('matches retained nullish defaults and omitted fetch options', () => {
    const legacy = readModelExtensionContract('runLegacyModelDefaultContract.cjs');
    const candidate = readModelExtensionContract('runCandidateModelDefaultContract.cjs');
    assert.deepStrictEqual(candidate, legacy);
  });
});
