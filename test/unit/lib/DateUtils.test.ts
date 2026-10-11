import assert from 'assert';

import ORM from 'backbone-orm';

const DateUtils = ORM.DateUtils;

describe('DateUtils', () => {
  it('preserves every published duration multiplier', () => {
    assert.deepStrictEqual(
      ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'].map((units) => DateUtils.durationAsMilliseconds(2, units)),
      [2, 2000, 120_000, 2_880_000, 172_800_000, 1_209_600_000, 5_184_000_000, 63_072_000_000]
    );
  });

  it('retains the legacy invalid-unit error', () => {
    assert.throws(() => DateUtils.durationAsMilliseconds(1, 'fortnights'), {
      message: 'DateUtils.durationAsMilliseconds :Unrecognized units: fortnights',
    });
  });

  it('compares valueOf results and uses numeric coercion for equality', () => {
    const early = { valueOf: () => 10 };
    const late = { valueOf: () => 20 };
    assert.strictEqual(DateUtils.isBefore(early, late), true);
    assert.strictEqual(DateUtils.isAfter(late, early), true);
    assert.strictEqual(DateUtils.isEqual(new Date(10), early), true);
    assert.strictEqual(DateUtils.isEqual(Number.NaN, Number.NaN), false);
  });
});
