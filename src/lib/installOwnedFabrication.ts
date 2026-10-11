import type { BackboneORMRuntime, FabricatorConstructor, TestUtilsConstructor } from '../types.ts';
import createFabricator from './Fabricator.ts';
import TestUtils from './TestUtils.ts';

const fabricationStateKey = Symbol.for('backbone-orm.fabrication.owned-state');

interface FabricationState {
  Fabricator: FabricatorConstructor;
  TestUtils: TestUtilsConstructor;
}

type StatefulFabricationRuntime = BackboneORMRuntime & {
  [fabricationStateKey]?: FabricationState;
};

export default function installOwnedFabrication(inputRuntime: BackboneORMRuntime): void {
  const runtime = inputRuntime as StatefulFabricationRuntime;
  const installed = runtime[fabricationStateKey];
  if (installed) {
    runtime.Fabricator = installed.Fabricator;
    runtime.TestUtils = installed.TestUtils;
    return;
  }

  const state: FabricationState = {
    Fabricator: createFabricator(runtime.Queue, runtime._ as Parameters<typeof createFabricator>[1]),
    TestUtils,
  };
  runtime.Fabricator = state.Fabricator;
  runtime.TestUtils = state.TestUtils;
  Object.defineProperty(runtime, fabricationStateKey, { value: state });
}
