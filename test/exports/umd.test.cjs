const assert = require('assert');
const Backbone = require('backbone');
const Root = require('backbone-orm');
const BackboneORM = require('backbone-orm/umd');

describe('Node UMD require export', () => {
  it('resolves the shared Node runtime with the consumer Backbone', () => {
    assert.equal(typeof BackboneORM.sync, 'function');
    assert.strictEqual(BackboneORM.Backbone, Backbone);
    assert.strictEqual(BackboneORM, Root);
  });
});
