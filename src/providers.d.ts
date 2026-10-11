declare module 'lru-cache' {
  class LRUCache {
    constructor(options?: Record<string, unknown>);
    del(key: unknown): void;
    forEach(callback: (value: unknown, key: unknown, cache: LRUCache) => unknown): void;
    get(key: unknown): unknown;
    has(key: unknown): boolean;
    peek(key: unknown): unknown;
    reset(): void;
    set(key: unknown, value: unknown, maxAge?: number): boolean;
  }

  export = LRUCache;
}

declare module 'inflection' {
  interface Inflection {
    readonly version: string;
    camelize(value: string, lowFirstLetter?: boolean): string;
    classify(value: string): string;
    pluralize(value: string): string;
    singularize(value: string): string;
    underscore(value: string): string;
  }

  const inflection: Inflection;
  export = inflection;
}
