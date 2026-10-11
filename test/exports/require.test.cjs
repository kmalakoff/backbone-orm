const assert = require('assert');
const BackboneORM = require('backbone-orm');
const packageMetadata = require('backbone-orm/package.json');

describe('exports CommonJS require', () => {
  it('resolves the package runtime', () => {
    assert.equal(typeof BackboneORM.sync, 'function');
  });

  it('resolves the declared package metadata subpath', () => {
    assert.equal(packageMetadata.name, 'backbone-orm');
    assert.equal(packageMetadata.version, '0.7.14');
  });
});
