import installRuntime from './installRuntime.ts';
import type { BackboneORMRuntime } from './types.ts';

export interface BrowserRuntimeGlobal {
  Backbone?: unknown;
  BackboneORM?: unknown;
}

export function installBrowserRuntime(browserGlobal: BrowserRuntimeGlobal): BackboneORMRuntime {
  const runtime = browserGlobal.BackboneORM;
  if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) throw new Error('BackboneORM browser runtime is missing');
  if (!browserGlobal.Backbone) throw new Error('Backbone browser runtime is missing');
  if (Reflect.get(runtime, 'Backbone') !== browserGlobal.Backbone) throw new Error('BackboneORM and Backbone must use the same Backbone instance');
  return installRuntime(runtime).runtime;
}

const BackboneORM = installBrowserRuntime(globalThis);

export const configureModel = BackboneORM.configureModel;
export default BackboneORM;
export * from './types.ts';
