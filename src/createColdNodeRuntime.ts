import * as querystring from 'node:querystring';
import * as stream from 'node:stream';
import * as url from 'node:url';
import Backbone from 'backbone';
import inflection from 'inflection';
import LRUCache from 'lru-cache';
import underscore from 'underscore';

import MemoryStore, { installMemoryStoreDependencies } from './cache/MemoryStore.ts';
import ModelCache, { installModelCacheDependencies } from './cache/ModelCache.ts';
import UnderscoreConvention from './conventions/UnderscoreConvention.ts';
import installBackbonePatch from './installBackbonePatch.ts';
import { installColdRuntime } from './installRuntime.ts';
import type { BackboneORMRuntime, RuntimeUtilsConstructor } from './types.ts';

function Utils(): void {}

export default function createColdNodeRuntime(): BackboneORMRuntime {
  // Exact parity providers stay pinned pending the pre-1.0 provider and security review.
  installMemoryStoreDependencies(LRUCache, underscore);
  installModelCacheDependencies(underscore);
  installBackbonePatch(Backbone);

  const runtime = {
    _: underscore,
    Backbone,
    ConnectionPool: new MemoryStore({
      destroy(_key: unknown, connection: { destroy(): unknown }) {
        return connection.destroy();
      },
    }),
    Utils: Utils as RuntimeUtilsConstructor,
    model_cache: new ModelCache(),
    modules: {
      backbone: Backbone,
      inflection,
      'lru-cache': LRUCache,
      querystring,
      stream,
      underscore,
      url,
    },
    naming_conventions: UnderscoreConvention,
  } as unknown as BackboneORMRuntime;

  return installColdRuntime(runtime).runtime;
}
