type Dynamic = any;

function tag(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return `function:${value.name}`;
  return `${typeof value}:${String(value)}`;
}

function own(value: Dynamic, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function observeURL(ORM: Dynamic, value: string, parseQueryString?: boolean): Record<string, unknown> {
  const url = new ORM.DatabaseURL(value, parseQueryString);
  return {
    fields: {
      auth: tag(url.auth),
      database: tag(url.database),
      hash: tag(url.hash),
      host: tag(url.host),
      hostname: tag(url.hostname),
      hosts: url.hosts,
      href: tag(url.href),
      port: tag(url.port),
      protocol: tag(url.protocol),
      query: url.query,
      search: tag(url.search),
      slashes: tag(url.slashes),
      table: tag(url.table),
    },
    hasOwn: ['auth', 'database', 'hash', 'host', 'hostname', 'hosts', 'href', 'port', 'protocol', 'query', 'search', 'slashes', 'table'].filter((key) => own(url, key)),
    formatted: url.format(),
    noQuery: url.format({ exclude_query: true }),
    noSearch: url.format({ exclude_search: true }),
    noTable: url.format({ exclude_table: true }),
    modelName: url.modelName(),
    parsedAuth: url.parseAuth(),
  };
}

export default function observeDatabaseFoundation(ORM: Dynamic): Record<string, unknown> {
  ORM.configure({ naming_conventions: 'default' });
  const standard = observeURL(ORM, 'protocol://user:password@host:80/database/model_names?query1=true&query2="bob"');
  const parsedQuery = observeURL(ORM, 'protocol://user:password@host:80/database/model_names?query1=true&query2="bob"', true);
  const multiple = observeURL(ORM, 'protocol://user:password@host1:81,host2:82,host3:83/database/model_names?query1=true&query2="bob"');
  const nested = observeURL(ORM, 'sqlite://localhost/root/nested/table_name#fragment');
  const noPassword = new ORM.DatabaseURL('memory://user@host/database/table');
  const colonPassword = new ORM.DatabaseURL('memory://user:first:ignored@host/database/table');

  const conventionResults: Record<string, unknown> = {};
  for (const name of ['default', 'underscore', 'camelize', 'classify']) {
    const result = ORM.configure({ naming_conventions: name });
    conventionResults[name] = {
      attributePlural: ORM.naming_conventions.attribute('LineItem', true),
      attributeSingular: ORM.naming_conventions.attribute('LineItems', false),
      configureReturn: result.map(tag),
      foreignPlural: ORM.naming_conventions.foreignKey('LineItems', true),
      foreignSingular: ORM.naming_conventions.foreignKey('LineItem', false),
      modelPlural: ORM.naming_conventions.modelName('line_items', true),
      modelSingular: ORM.naming_conventions.modelName('line_items', false),
      table: ORM.naming_conventions.tableName('LineItem'),
    };
  }

  const live = new ORM.DatabaseURL('memory://host/database/line_items');
  class UpperConvention extends ORM.BaseConvention {
    static modelName(tableName: string, plural?: boolean): string {
      return `UPPER_${super.modelName(tableName, plural).toUpperCase()}`;
    }
  }
  const beforeCustom = live.modelName();
  const customReturn = ORM.configure({ naming_conventions: UpperConvention }).map(tag);
  const afterCustom = live.modelName();
  const defaultReturn = ORM.configure({ naming_conventions: 'default' }).map(tag);
  const afterReset = live.modelName();

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...arguments_: unknown[]) => logs.push(arguments_.join(' '));
  const missingReturn = ORM.configure({ naming_conventions: 'missing' }).map(tag);
  console.log = originalLog;

  const inheritedOptions = Object.create({ inheritedFoundationValue: 2 }) as Record<string, unknown>;
  inheritedOptions.ownFoundationValue = 1;
  const inheritedReturn = ORM.configure(inheritedOptions).map(tag);

  const NamedFromPrototype = ORM.Backbone.Model.extend({ model_name: 'ExplicitModelName' });
  const NamedFromURL = ORM.Backbone.Model.extend({ url: 'memory://host/database/generated_names' });

  const result = {
    auth: {
      colonPassword: colonPassword.parseAuth(),
      noPassword: noPassword.parseAuth(),
    },
    configure: {
      inherited: [ORM.ownFoundationValue, ORM.inheritedFoundationValue],
      inheritedReturn,
      logs,
      missingReturn,
    },
    conventions: conventionResults,
    live: { afterCustom, afterReset, beforeCustom, customReturn, defaultReturn },
    modelNames: {
      prototype: ORM.Utils.findOrGenerateModelName(NamedFromPrototype),
      url: ORM.Utils.findOrGenerateModelName(NamedFromURL),
    },
    urls: { multiple, nested, parsedQuery, standard },
  };

  delete ORM.ownFoundationValue;
  delete ORM.inheritedFoundationValue;
  ORM.configure({ naming_conventions: 'default' });
  return result;
}
