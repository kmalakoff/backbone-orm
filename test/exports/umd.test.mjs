import assert from 'assert';
import Backbone from 'backbone';
import BackboneORM, { configureModel } from 'backbone-orm/umd';

describe('Node UMD import export', () => {
  it('resolves the shared Node runtime with the consumer Backbone', () => {
    assert.equal(typeof BackboneORM.sync, 'function');
    assert.strictEqual(BackboneORM.Backbone, Backbone);
    assert.strictEqual(configureModel, BackboneORM.configureModel);
  });
});
