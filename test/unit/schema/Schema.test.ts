import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

import { observePublishedRelationOperations, observePublishedSchemaRelationContract } from '../../lib/publicContractObservations.ts';

describe('Schema', () => {
  const readSchema = () => observePublishedSchemaRelationContract(ORM, Backbone);

  it('owns initialized fields, lazy parsing, aliases, and overrides', async () => {
    assert.deepStrictEqual((await readSchema()).schemaBasics, {
      aliases: { allColumns: ['id', 'lazy', 'no_type', 'plain'], allRelations: [] },
      beforeInitialize: { fieldKeys: ['id'], lazyCalls: 0, rawKeys: ['id', 'lazy', 'no_type', 'plain'] },
      columns: ['id', 'lazy', 'no_type', 'plain'],
      fields: {
        id: { indexed: true, manual: true, type: 'Integer' },
        lazy: { indexed: true, type: 'Date' },
        noType: { indexed: true },
        plain: { type: 'String' },
      },
      idType: 'String',
      initializeReturns: [undefined, undefined],
      lazyCalls: 1,
      plainOverrideAfterSet: 'Number',
      relationMissing: null,
      reverseMissing: null,
      typeMissing: null,
    });
  });

  it('constructs schemas through the public package', () => {
    const ModelType = Backbone.Model.extend({
      model_name: 'PublicSchemaConstructor',
      schema() {
        return { name: 'String' };
      },
    });
    const schema = new ORM.Schema(ModelType);
    schema.initialize();
    assert.strictEqual(schema.constructor, ORM.Schema);
    assert.deepStrictEqual(schema.field('name'), { type: 'String' });
  });

  it('preserves scalar fields and unsupported field errors', async () => {
    assert.deepStrictEqual((await observePublishedRelationOperations(ORM, Backbone)).unsupportedFields, {
      nonString: 'Unexpected type name is not a string: {"type":7}',
      tooMany: 'Unexpected field options array: [{},{}]',
      unknownString: { type: 'CustomScalar' },
    });
  });

  it('preserves truthy fallbacks and inherited scalar options', async () => {
    const boundaries = (await readSchema()).translationBoundaries as Record<string, unknown>;
    assert.deepStrictEqual(boundaries.falsyOverrides, ['String', 'String', 'String']);
    assert.deepStrictEqual(boundaries.inheritedField, { indexed: true, manual: true, type: 'String' });
    assert.deepStrictEqual(boundaries.rawFalsy, { columns: ['id'], raw: {} });
    assert.deepStrictEqual(boundaries.nestedFallback, { idTypeUsesDeclaredType: true, typeUsesDeclaredType: false });
    assert.deepStrictEqual(boundaries.directMaps, { fieldFallsThrough: true, relationFallsThrough: true });
  });
});
