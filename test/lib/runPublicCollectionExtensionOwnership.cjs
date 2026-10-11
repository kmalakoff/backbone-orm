'use strict';

const Backbone = require('backbone');
const before = {
  fetch: Backbone.Collection.prototype.fetch,
  originals: Backbone.Collection.prototype._orm_original_fns,
  prepareModel: Backbone.Collection.prototype._prepareModel,
};
const ORM = require('backbone-orm');
const afterLoad = {
  fetch: Backbone.Collection.prototype.fetch,
  originals: Backbone.Collection.prototype._orm_original_fns,
  prepareModel: Backbone.Collection.prototype._prepareModel,
};

class ModelType extends Backbone.Model {
  get model_name() {
    return 'PublicCollectionOwnershipModel';
  }

  schema() {
    return { name: 'String' };
  }
}

ORM.configureModel(ModelType);
const afterConfigure = {
  fetch: Backbone.Collection.prototype.fetch,
  originals: Backbone.Collection.prototype._orm_original_fns,
  prepareModel: Backbone.Collection.prototype._prepareModel,
};

process.stdout.write(
  `${JSON.stringify({
    boundaryAbsentAfterLoad: afterLoad.originals === undefined,
    fetchInstalledByConfigure: afterConfigure.fetch !== afterLoad.fetch,
    originalsCapturePriorFetch: afterConfigure.originals.fetch === afterLoad.fetch,
    originalsCapturePriorPrepareModel: afterConfigure.originals._prepareModel === afterLoad.prepareModel,
    prepareModelInstalledByConfigure: afterConfigure.prepareModel !== afterLoad.prepareModel,
    rootLoadPreservedBackboneMethods: before.fetch === afterLoad.fetch && before.prepareModel === afterLoad.prepareModel,
    runtimeBackboneIdentity: ORM.Backbone === Backbone,
  })}\n`
);
