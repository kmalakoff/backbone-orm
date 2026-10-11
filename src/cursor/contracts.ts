import type Backbone from 'backbone';

export type CursorCallback<T = unknown> = (error: Error | null, value?: T) => unknown;
export type CursorJSON = Record<string, unknown>;
export type CursorResult = unknown;

export interface CursorQuery {
  find: Record<string, unknown>;
  cursor: Record<string, unknown>;
}

export interface CursorDependencies {
  JSONUtils: {
    deepClone<T>(value: T): T;
    isEmptyObject(value: object): boolean;
    stringify?(value: unknown): string;
  };
  Utils: {
    updateOrNew?(json: CursorJSON, modelType: ModelType): Backbone.Model | null;
    jsonFieldCompare?(left: CursorJSON, right: CursorJSON, fields: string[]): number;
  };
}

export interface ModelType {
  new (...arguments_: never[]): Backbone.Model;
  cache?: unknown;
  cursor?(query?: unknown): { toJSON(callback: CursorCallback): unknown };
  model_name?: string;
  prototype: Backbone.Model;
  relation?(key: string): Relation | undefined;
  relationIsEmbedded?(key: string): boolean;
  reverseRelation?(key: string): Relation | undefined;
  schema?(): { relation(key: string): Relation | undefined };
}

export interface Relation {
  type?: string;
  model_type?: ModelType;
  reverse_model_type?: ModelType;
  reverse_relation?: Relation;
  join_table?: ModelType;
  join_key?: string;
  key?: string;
  foreign_key?: string;
  foriegn_key?: string;
  embed?: boolean;
  isEmbedded?(): boolean;
  cursor?(model: CursorJSON, key: string, query?: object): { toJSON(callback: CursorCallback): unknown };
}
