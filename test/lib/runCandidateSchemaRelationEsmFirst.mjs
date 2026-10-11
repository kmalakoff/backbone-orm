import Backbone from 'backbone';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const retainedSchema = require('../../backbone-orm.js').Schema;
const { default: esm } = await import('../../dist/esm/index.js');
const cjs = await import('../../dist/cjs/index.js').then((module) => module.default);
let Left;
let Right;
Left = Backbone.Model.extend({ model_name: 'MixedEsmFirstLeft', schema() { return { rights: () => ['hasMany', Right] }; } });
Right = Backbone.Model.extend({ model_name: 'MixedEsmFirstRight', schema() { return {}; } });
Left.prototype.sync = esm.sync(Left);
Right.prototype.sync = esm.sync(Right);
const relation = Left.relation('rights');
process.stdout.write(`${JSON.stringify({
  relationConstructorStable: relation.constructor === Left.relation('rights').constructor,
  runtimeShared: cjs === esm,
  schemaIsOwned: esm.Schema !== retainedSchema,
  schemaConstructorOwnsInstance: Left.schema().constructor === esm.Schema,
  schemaConstructorShared: cjs.Schema === esm.Schema,
  schemaInstanceShared: Left.schema() === cjs.sync(Left)('schema'),
  syncShared: cjs.sync === esm.sync,
})}\n`);
