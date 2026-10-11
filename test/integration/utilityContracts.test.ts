import assert from 'assert';

import readUtilityContract from '../lib/readUtilityContract.ts';

describe('Queue, IterationUtils, and DateUtils contracts', () => {
  it('matches the retained callback, return, error, ordering, and stack behavior', () => {
    const legacy = readUtilityContract('runLegacyUtilityContract.cjs');
    const candidate = readUtilityContract('runCandidateUtilityContract.cjs');
    assert.deepStrictEqual(candidate, legacy);

    const dates = legacy.dates as Record<string, unknown>;
    assert.deepStrictEqual(dates.durations, [2, 2000, 120_000, 2_880_000, 172_800_000, 1_209_600_000, 5_184_000_000, 63_072_000_000]);
    assert.strictEqual(dates.invalidMessage, 'DateUtils.durationAsMilliseconds :Unrecognized units: fortnights');

    const iteration = legacy.iteration as Record<string, unknown>;
    assert.deepStrictEqual(iteration.boundary, { return: 'undefined', synchronous: 300, total: 301 });
    assert.strictEqual(iteration.stackSafeCount, 30_001);

    const queue = legacy.queue as Record<string, unknown>;
    assert.deepStrictEqual(queue.completed, {
      awaitError: 'undefined',
      awaitReturn: 'string:completed-return',
      deferReturn: 'undefined',
    });
  });
});
