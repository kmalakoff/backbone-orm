import assert from 'assert';

import ORM from 'backbone-orm';

describe('BaseConvention', () => {
  it('supports the retained public subclass customization contract', () => {
    class UpperConvention extends ORM.BaseConvention {
      static override attribute(modelName: string, plural?: boolean): string {
        return ORM.BaseConvention.attribute(modelName.toLowerCase(), plural).toUpperCase();
      }
    }

    ORM.configure({ naming_conventions: UpperConvention });
    assert.strictEqual(ORM.naming_conventions.attribute('LineItem', true), 'LINEITEMS');
    assert.strictEqual(ORM.naming_conventions.foreignKey('LineItem'), 'line_item_id');
    ORM.configure({ naming_conventions: 'default' });
  });
});
