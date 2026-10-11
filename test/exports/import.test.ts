import assert from 'assert';
import BackboneORM from 'backbone-orm';

describe('exports TypeScript import', () => {
  it('resolves the package runtime', () => {
    assert.equal(typeof BackboneORM.sync, 'function');
  });
});
