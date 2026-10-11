import assert from 'assert';

import type { BackboneORMRuntime, DatabaseURLInstance } from 'backbone-orm';

interface URLProvider {
  parse(input: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): Record<string, unknown>;
}

function readURLProvider(runtime: BackboneORMRuntime): URLProvider {
  const modules = runtime.modules;
  assert.ok(modules !== null && typeof modules === 'object');
  const provider: unknown = Reflect.get(modules, 'url');
  assert.ok(provider !== null && typeof provider === 'object');
  assert.strictEqual(typeof Reflect.get(provider, 'parse'), 'function');
  return provider as URLProvider;
}

export default function databaseURLAuthorityTests(getRuntime: () => BackboneORMRuntime): void {
  it('formats supported ordered host lists and exact pool keys without malformed href', () => {
    const { DatabaseURL } = getRuntime();
    const url = new DatabaseURL('protocol://user:password@host1:81,host2:82,host3:83/database/model_names?query1=true&query2="bob"#a,b');
    const formatted = 'protocol://user:password@host1:81,host2:82,host3:83/database/model_names?query1=true&query2=%22bob%22#a,b';
    assert.deepStrictEqual(url.hosts, [
      { host: 'host1', hostname: 'host1:81', port: '81' },
      { host: 'host2', hostname: 'host2:82', port: '82' },
      { host: 'host3', hostname: 'host3:83', port: '83' },
    ]);
    assert.strictEqual(url.host, undefined);
    assert.strictEqual(url.hostname, undefined);
    assert.strictEqual(url.port, undefined);
    assert.strictEqual(url.database, 'database');
    assert.strictEqual(url.table, 'model_names');
    assert.strictEqual(url.format(), formatted);
    assert.strictEqual(url.href, formatted);
    assert.strictEqual(url.format({ exclude_table: true }), 'protocol://user:password@host1:81,host2:82,host3:83/database?query1=true&query2=%22bob%22#a,b');
    assert.strictEqual(url.format({ exclude_query: true }), 'protocol://user:password@host1:81,host2:82,host3:83/database/model_names#a,b');
    assert.strictEqual(url.format({ exclude_search: true }), url.format({ exclude_query: true }));
  });

  it('preserves raw host case and numeric port spelling without adding absent ports', () => {
    const { DatabaseURL } = getRuntime();
    for (const fixture of [
      { authority: 'Host1.Example:081,Host2.Example', hosts: [{ host: 'Host1.Example', hostname: 'Host1.Example:081', port: '081' }, { host: 'Host2.Example', hostname: 'Host2.Example' }] },
      { authority: '127.0.0.1:081,127.0.0.2:082', hosts: [{ host: '127.0.0.1', hostname: '127.0.0.1:081', port: '081' }, { host: '127.0.0.2', hostname: '127.0.0.2:082', port: '082' }] },
      { authority: 'host1,host2', hosts: [{ host: 'host1', hostname: 'host1' }, { host: 'host2', hostname: 'host2' }] },
    ]) {
      const input = `protocol://${fixture.authority}/database/model_names`;
      const url = new DatabaseURL(input);
      assert.deepStrictEqual(url.hosts, fixture.hosts);
      assert.strictEqual(url.href, input);
      assert.strictEqual(url.format(), input);
      assert.strictEqual(url.format({ exclude_table: true }), `protocol://${fixture.authority}/database`);
    }
  });

  it('preserves encoded auth and separates corrected auth pool keys from retained defects', () => {
    const { DatabaseURL } = getRuntime();
    for (const fixture of [
      { inputAuth: 'us%40er:p%2Cass', formattedAuth: 'us%40er:p%2Cass', user: 'us@er', password: 'p,ass' },
      { inputAuth: 'user:p,ass', formattedAuth: 'user:p%2Cass', user: 'user', password: 'p,ass' },
      { inputAuth: 'user:p@ass', formattedAuth: 'user:p%40ass', user: 'user', password: 'p@ass' },
    ]) {
      const url = new DatabaseURL(`protocol://${fixture.inputAuth}@host1:81,host2:82/database/model_names`);
      assert.deepStrictEqual(url.hosts, [{ host: 'host1', hostname: 'host1:81', port: '81' }, { host: 'host2', hostname: 'host2:82', port: '82' }]);
      assert.deepStrictEqual(url.parseAuth(), { user: fixture.user, password: fixture.password });
      assert.strictEqual(url.format(), `protocol://${fixture.formattedAuth}@host1:81,host2:82/database/model_names`);
      assert.strictEqual(url.format({ exclude_table: true }), `protocol://${fixture.formattedAuth}@host1:81,host2:82/database`);
      assert.strictEqual(url.href, url.format());
    }
  });

  it('keeps extra-colon parseAuth while using current provider auth encoding in corrected keys', () => {
    const runtime = getRuntime();
    const url = new runtime.DatabaseURL('protocol://user:first:ignored@host1:81,host2:82/database/model_names');
    const providerHref = readURLProvider(runtime).parse('protocol://user:first:ignored@host/database/model_names').href;
    assert.strictEqual(typeof providerHref, 'string');
    const expected = (providerHref as string).replace('@host/', '@host1:81,host2:82/');
    assert.strictEqual(url.auth, 'user:first:ignored');
    assert.deepStrictEqual(url.parseAuth(), { user: 'user', password: 'first' });
    assert.strictEqual(url.format(), expected);
    assert.strictEqual(url.href, expected);
    assert.strictEqual(url.format({ exclude_table: true }), expected.replace('/model_names', ''));
    assert.ok(!url.format().includes('@protocol://user'));
  });

  it('keeps nested database paths out of endpoint ports and preserves their pool key', () => {
    const url = new (getRuntime().DatabaseURL)('protocol://host1:81,host2:82/root/nested/model_names');
    assert.strictEqual(url.database, 'root/nested');
    assert.strictEqual(url.table, 'model_names');
    assert.deepStrictEqual(url.hosts?.[1], { host: 'host2', hostname: 'host2:82', port: '82' });
    assert.strictEqual(url.href, 'protocol://host1:81,host2:82/root/nested/model_names');
    assert.strictEqual(url.format({ exclude_table: true }), 'protocol://host1:81,host2:82/root/nested');
  });

  it('does not select a host list from commas in auth, pathname, query or fragment', () => {
    const { DatabaseURL } = getRuntime();
    for (const fixture of [
      { input: 'protocol://user:p,ass@host:80/database/model_names?tags=a,b#c,d', format: 'protocol://user:p%2Cass@host:80/database/model_names?tags=a,b#c,d' },
      { input: 'protocol://host:80/root,part/model_names', format: 'protocol://host:80/root,part/model_names' },
      { input: 'protocol://host:80/database/model_names?hosts=host1:81,host2:82#host3,host4', format: 'protocol://host:80/database/model_names?hosts=host1:81,host2:82#host3,host4' },
    ]) {
      const url = new DatabaseURL(fixture.input);
      assert.strictEqual(url.hosts, undefined);
      assert.strictEqual(url.host, 'host:80');
      assert.strictEqual(url.format(), fixture.format);
      assert.strictEqual(url.format({ exclude_table: true }), fixture.format.replace('/model_names', ''));
    }
    const listed = new DatabaseURL('protocol://host1:81,host2:82/database/model_names?tags=a,b#c,d');
    assert.strictEqual(listed.hosts?.length, 2);
    assert.strictEqual(listed.format(), 'protocol://host1:81,host2:82/database/model_names?tags=a,b#c,d');
    assert.strictEqual(listed.format({ exclude_query: true }), 'protocol://host1:81,host2:82/database/model_names#c,d');
  });

  it('preserves the current provider query prototypes, values and search precedence', () => {
    const runtime = getRuntime();
    const provider = readURLProvider(runtime);
    for (const querySuffix of ['?x=1&x=2&plus=a+b&empty=', '']) {
      const parsed = provider.parse(`protocol://host/database/model_names${querySuffix}`, true);
      for (const authority of ['host', 'host1:81,host2:82']) {
        const url = new runtime.DatabaseURL(`protocol://${authority}/database/model_names${querySuffix}`, true);
        const query = url.query;
        assert.ok(query !== null && typeof query === 'object');
        const prototype = Object.getPrototypeOf(query);
        assert.deepStrictEqual(query, parsed.query);
        assert.strictEqual(prototype, Object.getPrototypeOf(parsed.query));
        assert.strictEqual(url.search, parsed.search);
        const before = url.format();
        url.format({ exclude_query: true });
        url.format({ exclude_table: true });
        assert.strictEqual(url.format(), before);
        assert.strictEqual(url.query, query);
        assert.strictEqual(Object.getPrototypeOf(query), prototype);
        url.search = undefined;
        url.query = { x: ['one', 'two'], plus: 'a b', comma: 'a,b' };
        assert.strictEqual(url.format(), `protocol://${authority}/database/model_names?x=one&x=two&plus=a%20b&comma=a%2Cb`);
      }
    }
  });

  it('preserves single-authority parsing through the existing provider', () => {
    const runtime = getRuntime();
    const provider = readURLProvider(runtime);
    for (const input of [
      'protocol://user:password@host:80/database/model_names?query=true',
      'protocol://us%40er:p%2Cass@host:80/database/model_names',
      'protocol://[::1]:81/database/model_names',
      'sqlite://localhost/root/nested/table_name#fragment',
    ]) {
      const parsed = provider.parse(input);
      const url = new runtime.DatabaseURL(input);
      assert.strictEqual(url.hosts, undefined);
      for (const key of ['auth', 'host', 'hostname', 'port', 'href', 'search', 'query', 'hash']) assert.deepStrictEqual(Reflect.get(url, key), parsed[key]);
      assert.strictEqual(url.format(), parsed.href);
    }
  });

  it('rejects the five unsupported or invalid host-list cases with explicit categories', () => {
    const { DatabaseURL } = getRuntime();
    for (const fixture of [
      { input: 'protocol://[::1]:81,[::2]:82/database/model_names', message: 'Unsupported IPv6 database host list' },
      { input: 'protocol://host1:81,[::2]:82/database/model_names', message: 'Unsupported IPv6 database host list' },
      { input: '//host1:81,host2:82/database/model_names', message: 'Unsupported schemeless database host list' },
      { input: 'protocol://host1:bad,host2:82/database/model_names', message: 'Invalid ASCII database host-list member' },
      { input: 'protocol://host1:81,,host2:82/database/model_names', message: 'Empty database host-list member' },
    ]) assert.throws(() => new DatabaseURL(fixture.input, false, true), { name: 'TypeError', message: fixture.message });
  });

  it('declares trailing-dot DNS names unsupported within host lists', () => {
    assert.throws(() => new (getRuntime().DatabaseURL)('protocol://host1.example.:81,host2.example:82/database/model_names'), { name: 'TypeError', message: 'Invalid ASCII database host-list member' });
  });

  it('preserves malformed-auth rejection and ordinary invalid-port provider behavior', () => {
    const runtime = getRuntime();
    assert.throws(() => new runtime.DatabaseURL('protocol://user:%ZZ@host1:81,host2:82/database/model_names'), URIError);
    const provider = readURLProvider(runtime);
    const input = 'https://host:bad/database/model_names';
    let parsed: Record<string, unknown> | undefined;
    let parseError: unknown;
    try {
      parsed = provider.parse(input);
    } catch (error) {
      parseError = error;
    }
    if (parseError instanceof Error) {
      const expectedError = parseError;
      assert.throws(() => new runtime.DatabaseURL(input), (error: unknown) => error instanceof Error && error.name === expectedError.name && error.message === expectedError.message);
    } else {
      assert.ok(parsed);
      const url = new runtime.DatabaseURL(input);
      assert.strictEqual(url.hosts, undefined);
      assert.strictEqual(url.href, parsed.href);
      assert.strictEqual(url.format(), parsed.href);
    }
  });

  it('does not dispatch subclass format until derived initialization has completed', () => {
    const { DatabaseURL } = getRuntime();
    let overriddenCalls = 0;
    class DerivedURL extends DatabaseURL {
      suffix = 'initialized';

      override format(options?: Parameters<DatabaseURLInstance['format']>[0]): string {
        overriddenCalls++;
        assert.strictEqual(this.suffix, 'initialized');
        return `${super.format(options)}#${this.suffix}`;
      }
    }
    const url = new DerivedURL('protocol://host1:81,host2:82/database/model_names');
    assert.strictEqual(overriddenCalls, 0);
    assert.strictEqual(url.href, 'protocol://host1:81,host2:82/database/model_names');
    assert.strictEqual(url.format(), 'protocol://host1:81,host2:82/database/model_names#initialized');
    assert.strictEqual(url.format({ exclude_table: true }), 'protocol://host1:81,host2:82/database#initialized');
    assert.strictEqual(overriddenCalls, 2);
  });
}
