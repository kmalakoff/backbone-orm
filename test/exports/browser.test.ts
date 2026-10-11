import assert from 'assert';
import BackboneORM from 'backbone-orm/browser';

describe('exports browser import', () => {
  it('resolves the explicit browser runtime', () => {
    assert.equal(typeof BackboneORM.sync, 'function');
  });
});
