import assert from 'assert';

import ORM from 'backbone-orm';

import databaseURLAuthorityTests from '../../lib/databaseURLAuthorityTests.ts';

describe('DatabaseURL', () => {
  databaseURLAuthorityTests(() => ORM);

  it('preserves formatted connection pool keys', () => {
    const single = new ORM.DatabaseURL('protocol://user:password@host:80/database/model_names?query=true');
    assert.strictEqual(single.format(), 'protocol://user:password@host:80/database/model_names?query=true');
    assert.strictEqual(single.format({ exclude_table: true }), 'protocol://user:password@host:80/database?query=true');
    assert.strictEqual(single.format({ exclude_query: true }), 'protocol://user:password@host:80/database/model_names');

    const multiple = new ORM.DatabaseURL('protocol://host1:81,host2:82/database/model_names');
    assert.strictEqual(multiple.format(), 'protocol://host1:81,host2:82/database/model_names');
    assert.strictEqual(multiple.format({ exclude_table: true }), 'protocol://host1:81,host2:82/database');
  });

  it('uses the current naming convention for an existing URL object', () => {
    const url = new ORM.DatabaseURL('memory://host/database/line_items');
    ORM.configure({ naming_conventions: 'default' });
    assert.strictEqual(url.modelName(), 'LineItem');
    ORM.configure({ naming_conventions: 'classify' });
    assert.strictEqual(url.modelName(), 'LineItem');
    ORM.configure({ naming_conventions: 'default' });
  });
});
