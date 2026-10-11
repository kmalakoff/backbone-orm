import installOwnedCache from './cache/installOwnedCache.ts';
import installOwnedConnectionPool from './connection/ConnectionPool.ts';
import installFind from './find/index.ts';
import installOwnedDatabaseFoundation from './lib/installOwnedDatabaseFoundation.ts';
import installOwnedFabrication from './lib/installOwnedFabrication.ts';
import installOwnedJSONUtils from './lib/installOwnedJSONUtils.ts';
import installOwnedUtilities from './lib/installOwnedUtilities.ts';
import installOwnedSync from './memory/installOwnedSync.ts';
import installOwnedSchema from './schema/installOwnedSchema.ts';
import type { BackboneORMRuntime, ConfiguredModelConstructor, ConfigureModel, ModelConstructor } from './types.ts';

const configureModelTypeKey = Symbol.for('backbone-orm.static-find.configure-model-type');
const runtimeStateKey = Symbol.for('backbone-orm.runtime.owned-state');

type ConfigureModelType = (modelType: ModelConstructor<Backbone.Model>) => unknown;
type PatchedRuntimeUtils = BackboneORMRuntime['Utils'] & {
  [key: symbol]: ConfigureModelType | undefined;
};

export interface RuntimeInstallation {
  configureModel: ConfigureModel;
  runtime: BackboneORMRuntime;
}

type StatefulRuntime = BackboneORMRuntime & {
  [runtimeStateKey]?: RuntimeInstallation;
};

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function assertFunction(owner: Record<PropertyKey, unknown>, key: PropertyKey): void {
  if (typeof owner[key] !== 'function') throw new Error(`Invalid BackboneORM runtime: missing ${String(key)}`);
}

function assertRuntime(input: unknown): asserts input is StatefulRuntime {
  if (!isObject(input)) throw new Error('Invalid BackboneORM runtime: expected an object');
  for (const key of ['Backbone', 'ConnectionPool', 'DateUtils', 'JSONUtils', 'Utils', '_', 'model_cache', 'modules']) {
    if ((key === 'DateUtils' || key === 'JSONUtils') && !input[runtimeStateKey]) continue;
    if (!isObject(input[key])) throw new Error(`Invalid BackboneORM runtime: missing ${key}`);
  }
  for (const key of ['DatabaseURL', 'Fabricator', 'MemoryStore', 'Queue', 'Schema', 'TestUtils', 'configure', 'sync']) {
    if (!input[runtimeStateKey]) continue;
    assertFunction(input, key);
  }

  const Backbone = input.Backbone as Record<PropertyKey, unknown>;
  assertFunction(Backbone, 'Collection');
  assertFunction(Backbone, 'Model');

  const Utils = input.Utils as Record<PropertyKey, unknown>;
  if (input[runtimeStateKey]) assertFunction(Utils, 'configureModelType');

  const underscore = input._ as Record<PropertyKey, unknown>;
  for (const key of ['clone', 'compact', 'defer', 'extend', 'isArray', 'isDate', 'isFunction', 'isNaN', 'isObject', 'isString', 'map', 'pick', 'result']) assertFunction(underscore, key);

  const modelCache = input.model_cache as Record<PropertyKey, unknown>;
  assertFunction(modelCache, 'configure');
  assertFunction(modelCache, 'configureSync');

  const modules = input.modules as Record<PropertyKey, unknown>;
  if (!isObject(modules['lru-cache'])) throw new Error('Invalid BackboneORM runtime: missing modules.lru-cache');
  if (!isObject(modules.inflection)) throw new Error('Invalid BackboneORM runtime: missing modules.inflection');
  for (const key of ['camelize', 'classify', 'pluralize', 'singularize', 'underscore']) assertFunction(modules.inflection, key);
  if (!isObject(modules.url)) throw new Error('Invalid BackboneORM runtime: missing modules.url');
  for (const key of ['format', 'parse']) assertFunction(modules.url, key);
}

function installOwnedRuntime(runtime: BackboneORMRuntime): RuntimeInstallation {
  const statefulRuntime = runtime as StatefulRuntime;
  const installed = statefulRuntime[runtimeStateKey];
  if (installed) return installed;

  const runtimeUtils = runtime.Utils as PatchedRuntimeUtils;
  installOwnedUtilities(runtime);
  installOwnedFabrication(runtime);
  installOwnedDatabaseFoundation(runtime);
  installOwnedJSONUtils(runtime);
  installOwnedConnectionPool(runtime.ConnectionPool);
  const ownedSchema = installOwnedSchema(runtime);
  installOwnedCache(runtime);
  installOwnedSync(runtime, ownedSchema.cleanup);

  if (!Object.getOwnPropertyDescriptor(runtimeUtils, configureModelTypeKey)) {
    const configureModelType = runtimeUtils.configureModelType;
    Object.defineProperty(runtimeUtils, configureModelTypeKey, { value: configureModelType });
    runtimeUtils.configureModelType = function configureModelTypeWithFind(modelType) {
      const result = configureModelType.call(this, modelType);
      installFind(modelType);
      return result;
    };
  }

  const configureModel = function configureModel<C extends ModelConstructor<Backbone.Model>>(modelType: C): ConfiguredModelConstructor<C> {
    modelType.prototype.sync = runtime.sync(modelType);
    return Object.assign(modelType, { find: installFind(modelType) }) as unknown as ConfiguredModelConstructor<C>;
  } as ConfigureModel;

  runtime.configureModel = configureModel;
  const state = { configureModel, runtime };
  Object.defineProperty(statefulRuntime, runtimeStateKey, { value: state });
  assertRuntime(runtime);
  return state;
}

export function installColdRuntime(runtime: BackboneORMRuntime): RuntimeInstallation {
  return installOwnedRuntime(runtime);
}

export default function installRuntime(inputRuntime: unknown): RuntimeInstallation {
  assertRuntime(inputRuntime);
  return installOwnedRuntime(inputRuntime);
}
