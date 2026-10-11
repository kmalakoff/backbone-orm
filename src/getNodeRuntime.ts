import Module from 'node:module';

import type { BackboneORMRuntime } from './types.ts';

export default function getNodeRuntime(): BackboneORMRuntime {
  const isESM = typeof require === 'undefined';
  const runtimeRequire = isESM ? Module.createRequire(import.meta.url) : require;
  return runtimeRequire(isESM ? '../cjs/nodeRuntime.js' : './nodeRuntime.js') as BackboneORMRuntime;
}
