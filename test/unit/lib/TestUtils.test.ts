import assert from 'assert';
import ORM from 'backbone-orm';

describe('TestUtils', () => {
  it('retains its constructible class and static method shape', () => {
    const Constructor: unknown = ORM.TestUtils;
    if (typeof Constructor !== 'function') throw new TypeError('TestUtils must remain a function');
    assert.ok(new ORM.TestUtils() instanceof Constructor);
    assert.throws(() => Reflect.apply(Constructor, undefined, []), TypeError);
    assert.strictEqual(ORM.TestUtils.optionSets.length, 0);
  });

  it('returns fresh independent option sets', () => {
    const first = ORM.TestUtils.optionSets();
    const second = ORM.TestUtils.optionSets();

    assert.deepStrictEqual(first, [
      { cache: false, embed: false, $tags: '@no_cache @no_embed @quick' },
      { cache: true, embed: false, $tags: '@cache @no_embed' },
      { cache: false, embed: true, $tags: '@no_cache @embed' },
      { cache: true, embed: true, $tags: '@cache @embed' },
    ]);
    assert.notStrictEqual(first, second);
    for (let index = 0; index < first.length; index += 1) assert.notStrictEqual(first[index], second[index]);

    first[0].cache = true;
    first[0].$tags = 'changed';
    assert.deepStrictEqual(second[0], { cache: false, embed: false, $tags: '@no_cache @no_embed @quick' });
  });
});
