import type { NamingConvention } from '../conventions/contracts.ts';

const SUPPORTED_KEYS = ['protocol', 'slashes', 'auth', 'host', 'hostname', 'port', 'search', 'query', 'hash', 'href'] as const;

type SupportedKey = (typeof SUPPORTED_KEYS)[number];

export interface DatabaseURLFormatOptions {
  exclude_query?: boolean;
  exclude_search?: boolean;
  exclude_table?: boolean;
}

export interface DatabaseURLHost {
  host: string;
  hostname: string;
  port?: string;
}

export interface ParsedURL extends Partial<Record<SupportedKey, unknown>> {
  pathname: string;
}

export interface RuntimeURLModule {
  format(parts: Record<string, unknown>): string;
  parse(url: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): ParsedURL;
}

export interface DatabaseURLUnderscore {
  compact<T>(values: T[]): T[];
  map<T, R>(values: T[], iterator: (value: T) => R): R[];
  pick<T extends object>(value: T, ...keys: string[]): Partial<T>;
}

interface DatabaseURLDependencies {
  namingConventions(): NamingConvention;
  underscore: DatabaseURLUnderscore;
  url: RuntimeURLModule;
}

let dependencies: DatabaseURLDependencies | undefined;

export function installDatabaseURLDependencies(nextDependencies: DatabaseURLDependencies): void {
  dependencies = nextDependencies;
}

function getDependencies(): DatabaseURLDependencies {
  if (!dependencies) throw new Error('DatabaseURL dependencies are not installed');
  return dependencies;
}

function formatDatabaseURL(value: DatabaseURL, options: DatabaseURLFormatOptions = {}): string {
  const { underscore, url: URL } = getDependencies();
  const urlParts = underscore.pick(value, ...SUPPORTED_KEYS) as Record<string, unknown>;
  urlParts.pathname = '';

  if (value.hosts) {
    const hostStrings = underscore.map(value.hosts, (host) => `${host.host}${host.port ? `:${host.port}` : ''}`);
    urlParts.pathname += hostStrings.join(',');
    urlParts.host = '{1}';
  }

  if (value.database) urlParts.pathname += `/${value.database}`;
  if (value.table && !options.exclude_table) urlParts.pathname += `/${value.table}`;
  if (options.exclude_search || options.exclude_query) {
    delete urlParts.search;
    delete urlParts.query;
  }
  let url = URL.format(urlParts);
  if (value.hosts) url = url.replace(`{1}/${urlParts.pathname}`, String(urlParts.pathname));
  return url;
}

export default class DatabaseURL {
  auth?: string | null;
  database: string;
  hash?: string | null;
  host?: string | null;
  hostname?: string | null;
  hosts?: DatabaseURLHost[];
  href?: string | null;
  port?: string | null;
  protocol?: string | null;
  query?: unknown;
  search?: string | null;
  slashes?: boolean | null;
  table?: string;

  constructor(url: string, parseQueryString?: boolean, slashesDenoteHost?: boolean) {
    const { underscore, url: URL } = getDependencies();
    const authority = /^(?:([a-z0-9.+-]+:)\/\/|\/\/)([^/?#]*)([\s\S]*)$/i.exec(url);
    const rawAuthority = authority?.[2];
    const at = rawAuthority?.lastIndexOf('@') ?? -1;
    const authPrefix = rawAuthority === undefined || at === -1 ? '' : rawAuthority.slice(0, at + 1);
    const hostList = rawAuthority?.slice(at + 1);
    const isList = hostList?.includes(',') === true;
    let parseInput = url;
    let listHosts: DatabaseURLHost[] | undefined;

    if (isList && authority && hostList !== undefined) {
      if (!authority[1]) throw new TypeError('Unsupported schemeless database host list');
      const members = hostList.split(',');
      listHosts = [];
      for (const member of members) {
        if (!member) throw new TypeError('Empty database host-list member');
        if (member.includes('[') || member.includes(']')) throw new TypeError('Unsupported IPv6 database host list');
        const endpoint = /^([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]+))?$/i.exec(member);
        if (!endpoint || endpoint[1].split('.').some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) {
          throw new TypeError('Invalid ASCII database host-list member');
        }
        const parsedEndpoint = URL.parse(`${authority[1]}//${member}/`, false, true);
        const rawPort = endpoint[2];
        if (parsedEndpoint.pathname !== '/' || parsedEndpoint.hostname == null || (rawPort !== undefined && parsedEndpoint.port !== rawPort)) {
          throw new TypeError('Invalid database host-list endpoint');
        }
        listHosts.push(rawPort === undefined ? { host: endpoint[1], hostname: endpoint[1] } : { host: endpoint[1], hostname: member, port: rawPort });
      }
      parseInput = `${authority[1]}//${authPrefix}database-host-list.invalid${authority[3]}`;
    }

    const urlParts = URL.parse(parseInput, parseQueryString, slashesDenoteHost);
    if (listHosts) {
      delete urlParts.host;
      delete urlParts.hostname;
      delete urlParts.port;
    }

    const databaseParts = underscore.compact(urlParts.pathname.split('/'));
    this.table = databaseParts.pop();
    this.database = databaseParts.join('/');
    for (const key of SUPPORTED_KEYS) {
      if (Reflect.apply(Object.prototype.hasOwnProperty, urlParts, [key])) Reflect.set(this, key, urlParts[key]);
    }
    if (listHosts) {
      this.hosts = listHosts;
      this.href = formatDatabaseURL(this);
    }
  }

  format(options: DatabaseURLFormatOptions = {}): string {
    return formatDatabaseURL(this, options);
  }

  parseAuth(): { password: string | null; user: string } | null {
    if (!this.auth) return null;
    const authParts = this.auth.split(':');
    return { user: authParts[0], password: authParts.length > 1 ? authParts[1] : null };
  }

  modelName(): string | null {
    return this.table ? getDependencies().namingConventions().modelName(this.table, false) : null;
  }
}
