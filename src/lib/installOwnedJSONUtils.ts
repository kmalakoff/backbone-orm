import type { BackboneORMRuntime } from '../types.ts';
import JSONUtils, { installJSONUtilsDependencies, type JSONUtilsUnderscore } from './JSONUtils.ts';

const jsonUtilsStateKey = Symbol.for('backbone-orm.json-utils.owned-state');

type JSONUtilsRuntime = BackboneORMRuntime & {
  [jsonUtilsStateKey]?: typeof JSONUtils;
};

export default function installOwnedJSONUtils(inputRuntime: BackboneORMRuntime): void {
  const runtime = inputRuntime as JSONUtilsRuntime;
  installJSONUtilsDependencies({
    iteration: runtime.Utils,
    Queue: runtime.Queue,
    underscore: runtime._ as JSONUtilsUnderscore,
  });
  const installed = runtime[jsonUtilsStateKey];
  if (installed) {
    runtime.JSONUtils = installed;
    return;
  }
  runtime.JSONUtils = JSONUtils;
  Object.defineProperty(runtime, jsonUtilsStateKey, { value: JSONUtils });
}
