import type { JSONUtilsConstructor, QueueConstructor, RuntimeIterationUtils } from '../types.ts';

type JSONCallback<T = unknown> = (error?: Error | null, value?: T) => unknown;

interface RenderCursor {
  toJSON(callback: JSONCallback): unknown;
  toModels(callback: JSONCallback<RenderModel | RenderModel[]>): unknown;
}

interface RenderRelation {
  cursor(model: RenderModel, key: unknown, query?: unknown): RenderCursor;
}

interface RenderModel {
  [key: string]: unknown;
  get(key: string, callback: JSONCallback): unknown;
  relation(key: unknown): RenderRelation | undefined;
  toJSON(): unknown;
}

export interface JSONUtilsUnderscore {
  clone<T>(value: T): T;
  extend<T extends object>(target: T, source: object): T;
  isArray(value: unknown): value is unknown[];
  isDate(value: unknown): value is Date;
  isFunction(value: unknown): value is (...arguments_: unknown[]) => unknown;
  isNaN(value: unknown): boolean;
  isObject(value: unknown): boolean;
  isString(value: unknown): value is string;
}

interface JSONUtilsDependencies {
  iteration: RuntimeIterationUtils;
  Queue: QueueConstructor;
  underscore: JSONUtilsUnderscore;
}

let dependencies: JSONUtilsDependencies | undefined;

export function installJSONUtilsDependencies(nextDependencies: JSONUtilsDependencies): void {
  dependencies = nextDependencies;
}

function getDependencies(): JSONUtilsDependencies {
  if (!dependencies) throw new Error('JSONUtils dependencies are not installed');
  return dependencies;
}

function stringify(json: unknown): string | undefined {
  try {
    return JSON.stringify(json);
  } catch {
    return 'Failed to stringify';
  }
}

function isEmptyObject(object: unknown): boolean {
  for (const _key in object as object) return false;
  return true;
}

function parseDates(json: unknown): unknown {
  const { underscore } = getDependencies();
  if (underscore.isString(json)) {
    if (json.length >= 20 && json[json.length - 1] === 'Z') {
      const date = new Date(json);
      if (!underscore.isNaN(date.getTime())) return date;
    }
  } else if (underscore.isObject(json) || underscore.isArray(json)) {
    const object = json as Record<string, unknown>;
    for (const key in object) object[key] = parseDates(object[key]);
  }
  return json;
}

function parseField(value: unknown, modelType: unknown, key: string): unknown {
  const { underscore } = getDependencies();
  let idType: unknown;
  if (modelType != null) {
    const schema = (modelType as { schema(): { idType(field: string): unknown } }).schema();
    idType = schema.idType(key);
  }
  if (idType !== 'Integer') return parseDates(value);
  const integerValue = +(value as number);
  if (!underscore.isNaN(integerValue)) return integerValue;
  console.log(`Warning: failed to convert key: ${key} value: ${String(value)} to integer. Model: ${String(Reflect.get(modelType as object, 'model_name'))}`);
  return value;
}

function parse(object: unknown, modelType?: unknown): unknown {
  const { underscore } = getDependencies();
  if (!underscore.isObject(object)) return parseDates(object);
  if (underscore.isArray(object)) {
    const result: unknown[] = [];
    for (let index = 0; index < object.length; index += 1) result.push(parse(object[index], modelType));
    return result;
  }
  const result: Record<string, unknown> = {};
  for (const key in object as Record<string, unknown>) result[key] = parseField(Reflect.get(object as object, key), modelType, key);
  return result;
}

function parseQueryValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseQuery(query: Record<string, unknown>): Record<string, unknown> {
  const { underscore } = getDependencies();
  const json: Record<string, unknown> = {};
  for (const key in query) {
    let value = query[key];
    json[key] = value;
    if (underscore.isString(value) && value.length) {
      value = parseQueryValue(value);
      json[key] = parseDates(value);
    }
  }
  return json;
}

function querify(json: Record<string, unknown>): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = {};
  for (const key in json) query[key] = JSON.stringify(json[key]);
  return query;
}

function toQuery(_json: unknown): unknown {
  return console.log('JSONUtils.toQuery has been deprecated. Use JSONUtils.querify instead');
}

function renderTemplate(...parameters: [models: RenderModel | RenderModel[] | null | undefined, template: unknown, callback: JSONCallback] | [models: RenderModel | RenderModel[] | null | undefined, template: unknown, options: object, callback: JSONCallback]): unknown {
  const [models, template] = parameters;
  const options = parameters.length === 3 ? {} : parameters[2];
  const done = parameters.length === 3 ? parameters[2] : parameters[3];
  const { iteration, underscore } = getDependencies();
  if (!underscore.isArray(models)) {
    if (!models) return done(null, null);
    if (underscore.isString(template)) return renderKey(models, template, options as object, done);
    if (underscore.isArray(template)) return renderKeys(models, template as string[], options as object, done);
    if (underscore.isFunction(template)) return template(models, options, done);
    return renderDSL(models, template as Record<string, unknown>, options as object, done);
  }

  const results: unknown[] = [];
  return iteration.each(
    models,
    (model, next) =>
      renderTemplate(model, template, options as object, (error, relatedJSON) => {
        if (!error) results.push(relatedJSON);
        return next(error);
      }),
    (error) => (error ? done(error) : done(null, results))
  );
}

function renderDSL(...parameters: [model: RenderModel, dsl: Record<string, unknown>, callback: JSONCallback] | [model: RenderModel, dsl: Record<string, unknown>, options: object, callback: JSONCallback]): unknown {
  const [model, dsl] = parameters;
  const options = parameters.length === 3 ? {} : parameters[2];
  const done = parameters.length === 3 ? parameters[2] : parameters[3];
  const { Queue, underscore } = getDependencies();
  const queue = new Queue();
  const result: Record<string, unknown> = {};

  for (const originalKey in dsl) {
    const args = dsl[originalKey];
    queue.defer((next) => {
      let key = originalKey;
      const action = args as Record<string, unknown>;
      const field = action.key || key;
      const relation = model.relation(field);
      if (relation) {
        let query: unknown;
        let template: unknown;
        if (action.query) {
          query = action.query;
          template = action.template;
        } else if (action.$count) {
          query = underscore.clone(action);
          delete (query as Record<string, unknown>).key;
        } else if (underscore.isFunction(args)) {
          template = args;
        } else if (action.template) {
          if (underscore.isObject(action.template) && !underscore.isFunction(action.template)) {
            query = action.template;
          } else {
            template = action.template;
            query = underscore.clone(action);
            delete (query as Record<string, unknown>).key;
            delete (query as Record<string, unknown>).template;
            if (isEmptyObject(query)) query = null;
          }
        } else {
          template = underscore.clone(action);
          delete (template as Record<string, unknown>).key;
        }

        if (template) {
          if (query) {
            return relation.cursor(model, field, query).toModels((error, relatedModels) => {
              if (error) return next(error);
              return renderTemplate(relatedModels, template, options as object, (templateError, json) => {
                result[key] = json;
                return next(templateError);
              });
            });
          }
          return model.get(String(field), (error, relatedModel) => {
            if (error) return next(error);
            return renderTemplate(relatedModel as RenderModel | RenderModel[] | null, template, options as object, (templateError, json) => {
              result[key] = json;
              return next(templateError);
            });
          });
        }
        return relation.cursor(model, field, query).toJSON((error, json) => {
          result[key] = json;
          return next(error);
        });
      }

      if (key.length > 1 && key[key.length - 1] === '_') key = key.slice(0, -1);
      if (key === '$select') {
        if (underscore.isString(args)) {
          return renderKey(model, args, options as object, (error, json) => {
            result[args] = json;
            return next(error);
          });
        }
        return renderKeys(model, args as string[], options as object, (error, json) => {
          if (json && typeof json === 'object') underscore.extend(result, json);
          return next(error);
        });
      }
      if (underscore.isString(args)) {
        return renderKey(model, args, options as object, (error, json) => {
          result[key] = json;
          return next(error);
        });
      }
      if (underscore.isFunction(args)) {
        return args(model, options, (error: Error | null, json: unknown) => {
          result[key] = json;
          return next(error);
        });
      }
      if (underscore.isString(action.method)) {
        const functionArguments = underscore.isArray(action.args) ? action.args.slice() : action.args ? [action.args] : [];
        functionArguments.push((error: Error | null, json: unknown) => {
          result[key] = json;
          return next(error);
        });
        return Reflect.apply(Reflect.get(model, action.method) as (...arguments_: unknown[]) => unknown, model, functionArguments);
      }

      console.trace(`Unknown DSL action: ${key}: `, args);
      return next(new Error(`Unknown DSL action: ${key}: `));
    });
  }
  return queue.await((error) => done(error, error ? undefined : result));
}

function renderKeys(...parameters: [model: RenderModel, keys: string[], callback: JSONCallback<Record<string, unknown>>] | [model: RenderModel, keys: string[], options: object, callback: JSONCallback<Record<string, unknown>>]): unknown {
  const [model, keys] = parameters;
  const options = parameters.length === 3 ? {} : parameters[2];
  const done = parameters.length === 3 ? parameters[2] : parameters[3];
  const { Queue } = getDependencies();
  const result: Record<string, unknown> = {};
  const queue = new Queue();
  for (const key of keys) {
    queue.defer((next) =>
      renderKey(model, key, options as object, (error, value) => {
        if (error) return next(error);
        result[key] = value;
        return next();
      })
    );
  }
  return queue.await((error) => done(error, error ? undefined : result));
}

function renderKey(...parameters: [model: RenderModel, key: string, callback: JSONCallback] | [model: RenderModel, key: string, options: object, callback: JSONCallback]): unknown {
  const [model, key] = parameters;
  const done = parameters.length === 3 ? parameters[2] : parameters[3];
  const { underscore } = getDependencies();
  return model.get(key, (error, value) => {
    if (error) return done(error);
    if (model.relation(key)) {
      if (underscore.isArray(value))
        return done(
          null,
          value.map((item) => (item as RenderModel).toJSON())
        );
      if (value && typeof Reflect.get(value as object, 'toJSON') === 'function') return done(null, Reflect.apply(Reflect.get(value as object, 'toJSON'), value, []));
    }
    return done(null, value);
  });
}

function renderRelated(...parameters: [models: RenderModel | RenderModel[], attributeName: string, template: unknown, callback: JSONCallback] | [models: RenderModel | RenderModel[], attributeName: string, template: unknown, options: object, callback: JSONCallback]): unknown {
  const [models, attributeName, template] = parameters;
  const options = parameters.length === 4 ? {} : parameters[3];
  const done = parameters.length === 4 ? parameters[3] : parameters[4];
  const { Queue, underscore } = getDependencies();
  if (!underscore.isArray(models)) {
    return models.get(attributeName, (error, relatedModels) => {
      if (error) done(error);
      return renderTemplate(relatedModels as RenderModel | RenderModel[] | null, template, options as object, done);
    });
  }

  const results: unknown[] = [];
  const queue = new Queue();
  for (const model of models) {
    queue.defer((next) =>
      model.get(attributeName, (error, relatedModels) => {
        if (error) next(error);
        return renderTemplate(relatedModels as RenderModel | RenderModel[] | null, template, options as object, (templateError, relatedJSON) => {
          if (templateError) return next(templateError);
          results.push(relatedJSON);
          return next();
        });
      })
    );
  }
  return queue.await((error) => done(error, error ? undefined : results));
}

function deepClone<T>(object: T, depth?: number): T {
  const { underscore } = getDependencies();
  if (!object || typeof object !== 'object') return object;
  if (underscore.isString(object)) return Reflect.apply(String.prototype.slice, object, []) as T;
  if (underscore.isDate(object)) return new Date(object.getTime()) as T;
  const cloneMethod = Reflect.get(object, 'clone');
  if (underscore.isFunction(cloneMethod)) return Reflect.apply(cloneMethod, object, []) as T;

  let clone: unknown;
  if (underscore.isArray(object)) clone = Array.prototype.slice.call(object);
  else if ((Reflect.get(object, 'constructor') as unknown) !== Object) return object;
  else clone = underscore.extend({}, object);
  if (depth !== undefined && depth > 0) {
    for (const key in clone as Record<string, unknown>) Reflect.set(clone as object, key, deepClone(Reflect.get(clone as object, key), depth - 1));
  }
  return clone as T;
}

const JSONUtils = Object.assign(function JSONUtils(): void {}, {
  deepClone,
  isEmptyObject,
  parse,
  parseDates,
  parseField,
  parseQuery,
  querify,
  renderDSL,
  renderKey,
  renderKeys,
  renderRelated,
  renderTemplate,
  stringify,
  toQuery,
}) as unknown as JSONUtilsConstructor;

export default JSONUtils;
