import type { BackboneORMRuntime } from 'backbone-orm';

interface FixtureCache {
  get(key: string): unknown;
  set(key: string, value: object): unknown;
}

interface FixtureRuntime extends Pick<BackboneORMRuntime, 'BaseConvention' | 'Backbone' | 'ConnectionPool' | 'configure' | 'configureModel' | 'naming_conventions'> {
  adoption_marker?: unknown;
  model_cache: {
    caches: Record<string, { cache: unknown } | undefined>;
    enabled: unknown;
    options: { max?: unknown };
  };
}

function readFixtureCache(value: unknown): FixtureCache {
  if (value === null || typeof value !== 'object' || typeof Reflect.get(value, 'get') !== 'function' || typeof Reflect.get(value, 'set') !== 'function') {
    throw new Error('Expected a configured fixture cache with get/set');
  }
  return value as FixtureCache;
}

export const preservedPublicRuntimeState = {
  cacheEnabled: true,
  cacheEntry: true,
  cacheIdentity: true,
  cacheMax: true,
  marker: true,
  modelCacheIdentity: true,
  naming: true,
  poolEntry: true,
  poolIdentity: true,
};

export default async function observePublicRuntimeAdoption(first: FixtureRuntime, loadEntries: () => Promise<FixtureRuntime[]>): Promise<{
  runtimes: FixtureRuntime[];
  statePreserved: Record<string, boolean>;
}> {
  const marker = { id: 'public-entry-adoption' };
  class ConfiguredConvention extends first.BaseConvention {}
  first.configure({ model_cache: { enabled: true, max: 10 }, naming_conventions: ConfiguredConvention, adoption_marker: marker });
  const Model = first.Backbone.Model.extend({ model_name: 'PublicEntryAdoptionModel' });
  const configuredModel = first.configureModel(Model);
  const model = new Model({ id: 'seed' });
  const cache = readFixtureCache(configuredModel.cache);
  const cuid = Reflect.get(Model, 'cuid');
  if (typeof cuid !== 'string') throw new Error('Expected a configured fixture model cuid');
  cache.set('seed', model);
  const pool = first.ConnectionPool;
  pool.set('public-entry-adoption', marker);
  const modelCache = first.model_cache;
  const runtimes = await loadEntries();
  return {
    runtimes,
    statePreserved: {
      cacheEnabled: runtimes.every((runtime) => runtime.model_cache.enabled === true),
      cacheEntry: runtimes.every((runtime) => {
        const entry = runtime.model_cache.caches[cuid];
        return entry !== undefined && readFixtureCache(entry.cache).get('seed') === model;
      }),
      cacheIdentity: configuredModel.cache === cache,
      cacheMax: runtimes.every((runtime) => runtime.model_cache.options.max === 10),
      marker: runtimes.every((runtime) => runtime.adoption_marker === marker),
      modelCacheIdentity: runtimes.every((runtime) => runtime.model_cache === modelCache),
      naming: runtimes.every((runtime) => runtime.naming_conventions === ConfiguredConvention),
      poolEntry: runtimes.every((runtime) => runtime.ConnectionPool.get('public-entry-adoption') === marker),
      poolIdentity: runtimes.every((runtime) => runtime.ConnectionPool === pool),
    },
  };
}
