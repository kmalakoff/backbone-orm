'use strict';

const Backbone = require('backbone');
const retained = require('../../backbone-orm.js');
const retainedSchema = retained.Schema;
const cjs = require('../../dist/cjs/index.js');

import('../../dist/esm/index.js').then(
  ({ default: esm }) => {
    let Left;
    let Right;
    Left = Backbone.Model.extend({ model_name: 'MixedCjsFirstLeft', schema() { return { rights: () => ['hasMany', Right] }; } });
    Right = Backbone.Model.extend({ model_name: 'MixedCjsFirstRight', schema() { return {}; } });
    Left.prototype.sync = cjs.sync(Left);
    Right.prototype.sync = cjs.sync(Right);
    const relation = Left.relation('rights');
    const esmSchema = esm.sync(Left)('schema');
    process.stdout.write(`${JSON.stringify({
      relationInstanceShared: relation === esmSchema.relation('rights'),
      schemaIsOwned: cjs.Schema !== retainedSchema,
      runtimeShared: cjs === esm,
      schemaConstructorOwnsInstance: Left.schema().constructor === cjs.Schema,
      schemaConstructorShared: cjs.Schema === esm.Schema,
      schemaInstanceShared: Left.schema() === esm.sync(Left)('schema'),
      syncShared: cjs.sync === esm.sync,
    })}\n`);
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
