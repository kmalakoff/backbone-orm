import type { BackboneORMRuntime, RuntimeIterationUtils } from '../types.ts';
import DateUtils from './DateUtils.ts';
import createIterationUtils, { type IterationScheduler } from './IterationUtils.ts';
import Queue from './Queue.ts';
import createUtils from './Utils.ts';

function schedulerFor(runtime: BackboneORMRuntime): IterationScheduler {
  const processValue = Reflect.get(globalThis, 'process') as { nextTick?: IterationScheduler } | undefined;
  if (typeof processValue?.nextTick === 'function') return (callback) => processValue.nextTick?.(callback);
  const underscore = runtime._ as { defer: IterationScheduler };
  return (callback) => underscore.defer(callback);
}

export default function installOwnedUtilities(runtime: BackboneORMRuntime): void {
  const iteration = createIterationUtils(schedulerFor(runtime));
  const utils = runtime.Utils as RuntimeIterationUtils;

  runtime.Queue = Queue;
  runtime.DateUtils = DateUtils;
  utils.each = iteration.each;
  utils.eachC = (array, callback, iterator) => iteration.each(array, iterator, callback);
  utils.popEach = iteration.popEach;
  utils.popEachC = (array, callback, iterator) => iteration.popEach(array, iterator, callback);
  utils.eachDone = iteration.eachDone;
  utils.eachDoneC = (array, callback, iterator) => iteration.eachDone(array, iterator, callback);
  createUtils(runtime);
}
