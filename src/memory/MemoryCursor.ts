import Cursor, { type CursorConstructor, type CursorInstance, installCursorDependencies } from '../cursor/Cursor.ts';
import type { CursorCallback, CursorJSON, ModelType, Relation } from '../cursor/contracts.ts';
import type { MemoryModelConstructor, RuntimeDateUtils, RuntimeJSONUtils, RuntimeMemoryUtils, RuntimeQueueConstructor, RuntimeUnderscore } from './contracts.ts';

interface MemoryCursorOptions {
  model_type: MemoryModelConstructor;
  store: CursorJSON[];
}

export interface MemoryCursorInstance extends CursorInstance {
  store: CursorJSON[];
  model_type: MemoryModelConstructor;
  buildFindQuery(callback: CursorCallback<Record<string, unknown>>): unknown;
  fetchIncludes(json: CursorJSON[], callback: CursorCallback<CursorJSON[]>): unknown;
  _valueIsMatch(findQuery: Record<string, unknown>, keyPath: string, modelJSON: CursorJSON, callback: CursorCallback<boolean>): unknown;
}

let jsonUtils: RuntimeJSONUtils | undefined;
let utils: RuntimeMemoryUtils | undefined;
let dateUtils: RuntimeDateUtils | undefined;
let underscore: RuntimeUnderscore | undefined;
let Queue: RuntimeQueueConstructor | undefined;
const hasOwn = (value: object, key: PropertyKey): boolean => Reflect.getOwnPropertyDescriptor(value, key) !== undefined;

export function installMemoryCursorDependencies(nextJSONUtils: RuntimeJSONUtils, nextUtils: RuntimeMemoryUtils, nextDateUtils: RuntimeDateUtils, nextUnderscore: RuntimeUnderscore, nextQueue: RuntimeQueueConstructor): void {
  jsonUtils = nextJSONUtils;
  utils = nextUtils;
  dateUtils = nextDateUtils;
  underscore = nextUnderscore;
  Queue = nextQueue;
  installCursorDependencies({ JSONUtils: nextJSONUtils, Utils: nextUtils });
}

function getDependencies(): { DateUtils: RuntimeDateUtils; JSONUtils: RuntimeJSONUtils; Queue: RuntimeQueueConstructor; Utils: RuntimeMemoryUtils; underscore: RuntimeUnderscore } {
  if (!jsonUtils || !utils || !dateUtils || !underscore || !Queue) throw new Error('MemoryCursor dependencies are not installed');
  return { DateUtils: dateUtils, JSONUtils: jsonUtils, Queue, Utils: utils, underscore };
}

function valueToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  if (value && typeof value === 'object' && '$in' in value) return (value as { $in: unknown[] }).$in;
  return [value];
}

function mergeQuery(query: Record<string, unknown>, key: string, value: unknown): void {
  if (!hasOwn(query, key)) {
    query[key] = value;
    return;
  }
  const incoming = valueToArray(value);
  query[key] = { $in: valueToArray(query[key]).filter((item) => incoming.includes(item)) };
}

function MemoryCursor(this: MemoryCursorInstance, query: unknown, options: MemoryCursorOptions): void {
  Cursor.call(this, query, options as unknown as Record<string, unknown>);
}

Object.setPrototypeOf(MemoryCursor.prototype, Cursor.prototype);
Object.setPrototypeOf(MemoryCursor, Cursor);
MemoryCursor.prototype.constructor = MemoryCursor;

MemoryCursor.prototype.queryToJSON = function queryToJSON(this: MemoryCursorInstance, callback: CursorCallback): unknown {
  if (this.hasCursorQuery('$zero')) return callback(null, this.hasCursorQuery('$one') ? null : []);
  const exists = this.hasCursorQuery('$exists');

  this.buildFindQuery((buildError, builtQuery) => {
    if (buildError) return callback(buildError);
    const findQuery = builtQuery ?? {};
    const ins: Record<string, unknown[]> = {};
    const nins: Record<string, unknown[]> = {};
    for (const [key, value] of Object.entries(findQuery)) {
      if (!value || typeof value !== 'object') continue;
      if ('$in' in value) {
        delete findQuery[key];
        ins[key] = (value as { $in: unknown[] }).$in;
      }
      if ('$nin' in value) {
        delete findQuery[key];
        nins[key] = (value as { $nin: unknown[] }).$nin;
      }
    }
    const keys = Object.keys(findQuery);
    const idAttribute = this.model_type.prototype.idAttribute;
    const requestedIds = this._cursor.$ids as unknown[] | undefined;
    let json: CursorJSON[] = [];

    const findRows = (done: (error?: Error | null) => unknown): unknown => {
      if (keys.length === 0 && Object.keys(ins).length === 0 && Object.keys(nins).length === 0) {
        json = this.store.filter((modelJSON) => !requestedIds || requestedIds.includes(modelJSON[idAttribute])).map((modelJSON) => getDependencies().JSONUtils.deepClone(modelJSON));
        return done();
      }

      if (requestedIds) {
        json = this.store
          .filter((modelJSON) => requestedIds.includes(modelJSON[idAttribute]))
          .filter((modelJSON) => {
            const picked = Object.fromEntries(keys.map((key) => [key, modelJSON[key]]));
            return getDependencies().underscore.isEqual(picked, findQuery);
          })
          .map((modelJSON) => getDependencies().JSONUtils.deepClone(modelJSON));
        return done();
      }

      return getDependencies().Utils.each(
        this.store,
        (modelJSON, nextModel) => {
          if (exists && json.length) return nextModel();
          for (const [key, values] of Object.entries(ins)) if (!values.includes(modelJSON[key])) return nextModel();
          for (const [key, values] of Object.entries(nins)) if (values.includes(modelJSON[key])) return nextModel();
          let isMatch = true;
          return getDependencies().Utils.eachDone(
            keys,
            (key, nextKey) =>
              this._valueIsMatch(findQuery, key, modelJSON, (error, matches) => {
                isMatch = Boolean(matches);
                return nextKey(error, !isMatch);
              }),
            (error) => {
              if (!error && isMatch) json.push(getDependencies().JSONUtils.deepClone(modelJSON));
              return nextModel(error);
            }
          );
        },
        done
      );
    };

    return findRows((findError) => {
      if (findError) return callback(findError);
      if (exists) return callback(null, Boolean(json.length));

      if (this._cursor.$sort) {
        const fields = (Array.isArray(this._cursor.$sort) ? this._cursor.$sort : [this._cursor.$sort]) as string[];
        json.sort((left, right) => getDependencies().Utils.jsonFieldCompare?.(left, right, fields) ?? 0);
      }
      if (this._cursor.$unique) {
        const seen = new Set<string>();
        json = json.filter((modelJSON) => {
          let key = '';
          for (const field of this._cursor.$unique as string[]) {
            if (hasOwn(modelJSON, field)) key += `${field}:${JSON.stringify(modelJSON[field])}`;
          }
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (this._cursor.$offset) {
        const offset = this._cursor.$offset as number;
        json = json.length > offset ? json.slice(offset) : [];
      }
      if (this._cursor.$one) json = json.slice(0, 1);
      else if (this._cursor.$limit) json = json.slice(0, Math.min(json.length, this._cursor.$limit as number));

      return this.fetchIncludes(json, (includeError) => {
        if (includeError) return callback(includeError);
        if (this.hasCursorQuery('$count')) return callback(null, json.length);
        if (this.hasCursorQuery('$page')) {
          const countQuery = { ...(this._cursor.$unique ? { $unique: this._cursor.$unique } : {}), ...this._find };
          const CountCursor = MemoryCursor as unknown as new (query: unknown, options: MemoryCursorOptions) => MemoryCursorInstance;
          const countCursor = new CountCursor(countQuery, { model_type: this.model_type, store: this.store });
          return countCursor.count((countError: Error | null, count?: number) => {
            if (countError) return callback(countError);
            return callback(null, { offset: this._cursor.$offset ?? 0, total_rows: count, rows: this.selectResults(json) });
          });
        }
        return callback(null, this.selectResults(json));
      });
    });
  });
  return undefined;
};

MemoryCursor.prototype.buildFindQuery = function buildFindQuery(this: MemoryCursorInstance, callback: CursorCallback<Record<string, unknown>>): unknown {
  const findQuery: Record<string, unknown> = {};
  const queue = new (getDependencies().Queue)();

  for (const [key, value] of Object.entries(this._find)) {
    if (!key.includes('.')) {
      const reverseRelation = this.model_type.reverseRelation?.(key) as Relation | undefined;
      if (!reverseRelation || (!reverseRelation.embed && !reverseRelation.join_table)) {
        mergeQuery(findQuery, key, value);
        continue;
      }
      queue.defer((done) => {
        if (reverseRelation.embed) throw new Error(`Embedded find is not yet supported. @_find: ${getDependencies().JSONUtils.stringify(this._find)}`);
        const relatedQuery: Record<string, unknown> = { [key]: value, $values: reverseRelation.reverse_relation?.join_key };
        const joinTable = reverseRelation.join_table;
        if (!joinTable?.cursor) throw new TypeError(`Reverse relation '${key}' has no join-table cursor`);
        return joinTable.cursor(relatedQuery).toJSON((error, modelIds) => {
          if (error) return done(error);
          mergeQuery(findQuery, 'id', { $in: modelIds });
          return done();
        });
      });
      continue;
    }

    const [relationKey, valueKey] = key.split('.');
    if (this.model_type.relationIsEmbedded?.(relationKey)) {
      mergeQuery(findQuery, key, value);
      continue;
    }
    queue.defer((done) => {
      const relation = this.model_type.relation?.(relationKey) as Relation | undefined;
      if (!relation) {
        mergeQuery(findQuery, key, value);
        return done();
      }
      if (!relation.join_table && valueKey === 'id') {
        if (relation.foreign_key) mergeQuery(findQuery, relation.foreign_key, value);
        return done();
      }
      if (relation.join_table || relation.type === 'belongsTo') {
        const relatedQuery: Record<string, unknown> = { [valueKey]: value, $values: 'id' };
        const relatedType = relation.reverse_relation?.model_type;
        if (!relatedType?.cursor) throw new TypeError(`Relation '${relationKey}' has no reverse cursor`);
        return relatedType.cursor(relatedQuery).toJSON((error, relatedIds) => {
          if (error) return done(error);
          if (relation.join_table) {
            const joinKey = relation.reverse_relation?.join_key;
            const joinQuery: Record<string, unknown> = { $values: relation.foreign_key };
            if (joinKey) joinQuery[joinKey] = { $in: relatedIds };
            if (!relation.join_table.cursor) throw new TypeError(`Relation '${relationKey}' has no join-table cursor`);
            return relation.join_table.cursor(joinQuery).toJSON((joinError, modelIds) => {
              if (joinError) return done(joinError);
              mergeQuery(findQuery, 'id', { $in: modelIds });
              return done();
            });
          }
          if (relation.foreign_key) mergeQuery(findQuery, relation.foreign_key, { $in: relatedIds });
          return done();
        });
      }
      const relatedQuery: Record<string, unknown> = { [valueKey]: value, $values: relation.foreign_key };
      if (!relation.reverse_model_type?.cursor) throw new TypeError(`Relation '${relationKey}' has no related cursor`);
      return relation.reverse_model_type.cursor(relatedQuery).toJSON((error, modelIds) => {
        if (error) return done(error);
        mergeQuery(findQuery, 'id', { $in: modelIds });
        return done();
      });
    });
  }

  return queue.await((error) => callback(error ?? null, findQuery));
};

MemoryCursor.prototype.fetchIncludes = function fetchIncludes(this: MemoryCursorInstance, json: CursorJSON[], callback: CursorCallback<CursorJSON[]>): unknown {
  if (!this._cursor.$include) return callback(null, json);
  const includeKeys = (Array.isArray(this._cursor.$include) ? this._cursor.$include : [this._cursor.$include]) as string[];
  const loadQueue = new (getDependencies().Queue)(1);
  for (const key of includeKeys) {
    if (this.model_type.relationIsEmbedded?.(key)) continue;
    const relation = this.model_type.relation?.(key) as Relation | undefined;
    if (!relation) return callback(new Error(`Included relation '${key}' is not a relation`));
    if (!relation.cursor) throw new TypeError(`Included relation '${key}' has no cursor`);
    for (const modelJSON of json) {
      loadQueue.defer((done) =>
        relation.cursor?.(modelJSON, key).toJSON((error, relatedJSON) => {
          if (error) return done(error);
          if (relation.foriegn_key) delete modelJSON[relation.foriegn_key];
          modelJSON[key] = relatedJSON;
          return done();
        })
      );
    }
  }
  return loadQueue.await((error) => callback(error ?? null, json));
};

MemoryCursor.prototype._valueIsMatch = function valueIsMatch(this: MemoryCursorInstance, findQuery: Record<string, unknown>, keyPath: string, modelJSON: CursorJSON, callback: CursorCallback<boolean>): unknown {
  const findValue = findQuery[keyPath];
  const operatorNames = ['$ne', '$lt', '$lte', '$gt', '$gte', '$exists'] as const;
  const operators = findValue && typeof findValue === 'object' ? operatorNames.filter((operator) => hasOwn(findValue, operator)) : [];
  const keyComponents = keyPath.split('.');
  const isMatch = (json: CursorJSON, key: string): boolean => {
    const modelValue = json?.[key];
    if (operators.length) {
      for (const operator of operators) {
        const targetValue = (findValue as Record<string, unknown>)[operator];
        if (operator === '$ne' && getDependencies().underscore.isEqual(modelValue, targetValue)) return false;
        if (operator === '$exists' && (targetValue ? modelValue === undefined : modelValue !== undefined)) return false;
        if (operator === '$lt') {
          if (targetValue === null) throw new Error('Cannot compare to null');
          if (!(targetValue instanceof Date ? getDependencies().DateUtils.isBefore(modelValue, targetValue) : (modelValue as number) < (targetValue as number))) return false;
        }
        if (operator === '$lte') {
          if (targetValue === null) throw new Error('Cannot compare to null');
          if (!(targetValue instanceof Date ? !getDependencies().DateUtils.isAfter(modelValue, targetValue) : (modelValue as number) <= (targetValue as number))) return false;
        }
        if (operator === '$gt') {
          if (targetValue === null) throw new Error('Cannot compare to null');
          if (!(targetValue instanceof Date ? getDependencies().DateUtils.isAfter(modelValue, targetValue) : (modelValue as number) > (targetValue as number))) return false;
        }
        if (operator === '$gte') {
          if (targetValue === null) throw new Error('Cannot compare to null');
          if (!(targetValue instanceof Date ? !getDependencies().DateUtils.isBefore(modelValue, targetValue) : (modelValue as number) >= (targetValue as number))) return false;
        }
      }
      return true;
    }
    return getDependencies().underscore.isEqual(modelValue, findValue);
  };

  if (keyComponents.length === 1) return callback(null, isMatch(modelJSON, keyComponents[0]));
  let currentType = this.model_type as ModelType;
  const next = (error: Error | null, currentJSON?: unknown): unknown => {
    if (error) return callback(error);
    let key = keyComponents.shift() as string;
    if (key === 'id') key = currentType.prototype.idAttribute;
    if (keyComponents.length) {
      const relation = currentType.relation?.(key);
      if (relation && !relation.embed) {
        if (relation.reverse_model_type) currentType = relation.reverse_model_type;
        if (!relation.cursor) throw new TypeError(`Relation '${key}' has no cursor`);
        return relation.cursor(currentJSON as CursorJSON, key).toJSON(next);
      }
      return next(null, (currentJSON as CursorJSON)?.[key]);
    }
    if (!Array.isArray(currentJSON)) return callback(null, isMatch(currentJSON as CursorJSON, key));
    return callback(
      null,
      currentJSON.some((json) => isMatch(json as CursorJSON, key))
    );
  };
  return next(null, modelJSON);
};

export default MemoryCursor as unknown as CursorConstructor & {
  new (query: unknown, options: MemoryCursorOptions): MemoryCursorInstance;
  (this: MemoryCursorInstance, query: unknown, options: MemoryCursorOptions): void;
  prototype: MemoryCursorInstance;
};
