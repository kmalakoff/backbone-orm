import BaseConvention, { installConventionDependencies } from '../conventions/BaseConvention.ts';
import CamelizeConvention, { installCamelizeConventionDependencies } from '../conventions/CamelizeConvention.ts';
import ClassifyConvention, { installClassifyConventionDependencies } from '../conventions/ClassifyConvention.ts';
import type { NamingConvention, NamingConventionConstructor, RuntimeInflection } from '../conventions/contracts.ts';
import UnderscoreConvention, { installUnderscoreConventionDependencies } from '../conventions/UnderscoreConvention.ts';
import type { BackboneORMRuntime, DatabaseURLConstructor, ModelConstructor } from '../types.ts';
import DatabaseURL, { type DatabaseURLUnderscore, installDatabaseURLDependencies, type RuntimeURLModule } from './DatabaseURL.ts';

const databaseFoundationStateKey = Symbol.for('backbone-orm.database-foundation.owned-state');

interface FoundationUnderscore extends DatabaseURLUnderscore {
  result(value: object, key: string): unknown;
}

interface DatabaseFoundationRuntime extends BackboneORMRuntime {
  BaseConvention: NamingConventionConstructor;
  DatabaseURL: DatabaseURLConstructor;
  Utils: BackboneORMRuntime['Utils'];
  _: FoundationUnderscore;
  model_cache: BackboneORMRuntime['model_cache'] & { configure(options: unknown): unknown };
  modules: {
    inflection: RuntimeInflection;
    url: RuntimeURLModule;
  };
  naming_conventions: NamingConvention;
  [databaseFoundationStateKey]?: DatabaseFoundationState;
}

interface DatabaseFoundationState {
  BaseConvention: NamingConventionConstructor;
  DatabaseURL: DatabaseURLConstructor;
  configure: BackboneORMRuntime['configure'];
  findOrGenerateModelName: BackboneORMRuntime['Utils']['findOrGenerateModelName'];
}

function installDependencies(runtime: DatabaseFoundationRuntime): void {
  const inflection = runtime.modules.inflection;
  installConventionDependencies(inflection);
  installCamelizeConventionDependencies(inflection);
  installClassifyConventionDependencies(inflection);
  installUnderscoreConventionDependencies(inflection);
  installDatabaseURLDependencies({
    namingConventions: () => runtime.naming_conventions,
    underscore: runtime._,
    url: runtime.modules.url,
  });
}

export default function installOwnedDatabaseFoundation(inputRuntime: BackboneORMRuntime): void {
  const runtime = inputRuntime as DatabaseFoundationRuntime;
  installDependencies(runtime);

  const installed = runtime[databaseFoundationStateKey];
  if (installed) {
    runtime.BaseConvention = installed.BaseConvention;
    runtime.DatabaseURL = installed.DatabaseURL;
    runtime.configure = installed.configure;
    runtime.Utils.findOrGenerateModelName = installed.findOrGenerateModelName;
    return;
  }

  const conventions: Record<string, NamingConventionConstructor> = {
    default: UnderscoreConvention,
    underscore: UnderscoreConvention,
    camelize: CamelizeConvention,
    classify: ClassifyConvention,
  };

  if (runtime.naming_conventions == null) runtime.naming_conventions = UnderscoreConvention;

  const configure = function configure(options: object = {}): unknown[] {
    const results: unknown[] = [];
    const configuration = options as Record<string, unknown>;
    for (const key in configuration) {
      const value = configuration[key];
      if (key === 'model_cache') {
        results.push(runtime.model_cache.configure(value));
        continue;
      }
      if (key === 'naming_conventions') {
        if (typeof value === 'string') {
          const convention = conventions[value];
          if (convention) {
            runtime.naming_conventions = convention;
            continue;
          }
          results.push(console.log(`BackboneORM configure: could not find naming_conventions: ${value}. Available: ${Object.keys(conventions).join(', ')}`));
          continue;
        }
        runtime.naming_conventions = value as NamingConvention;
        results.push(value);
        continue;
      }
      Reflect.set(runtime, key, value);
      results.push(value);
    }
    return results;
  };

  const findOrGenerateModelName = function findOrGenerateModelName(modelType: ModelConstructor<Backbone.Model>): string {
    const prototype = modelType.prototype as Backbone.Model & { model_name?: string };
    if (prototype.model_name) return prototype.model_name;
    const url = runtime._.result(new modelType(), 'url');
    if (url) {
      const modelName = new DatabaseURL(String(url)).modelName();
      if (modelName) return modelName;
    }
    if (modelType.name) return modelType.name;
    throw `Could not find or generate model name for ${String(modelType)}`;
  };

  runtime.BaseConvention = BaseConvention;
  runtime.DatabaseURL = DatabaseURL as unknown as DatabaseURLConstructor;
  runtime.configure = configure;
  runtime.Utils.findOrGenerateModelName = findOrGenerateModelName;
  Object.defineProperty(runtime, databaseFoundationStateKey, {
    value: {
      BaseConvention: runtime.BaseConvention,
      DatabaseURL: runtime.DatabaseURL,
      configure,
      findOrGenerateModelName,
    },
  });
}
