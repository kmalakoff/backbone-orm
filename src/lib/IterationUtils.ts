export type IterationCallback = (error?: Error | null) => unknown;
export type IterationDoneCallback = (error?: Error | null, done?: boolean) => unknown;
export type IterationScheduler = (callback: () => unknown) => unknown;

export interface IterationUtilities {
  readonly MAX_ITERATION_COUNT: 300;
  each<T>(array: T[], iterator: (value: T, callback: IterationCallback) => unknown, callback: IterationCallback): unknown;
  eachDone<T>(array: T[], iterator: (value: T, callback: IterationDoneCallback) => unknown, callback: IterationCallback): unknown;
  popEach<T>(array: T[], iterator: (value: T, callback: IterationCallback) => unknown, callback: IterationCallback): unknown;
}

export default function createIterationUtils(nextTick: IterationScheduler): IterationUtilities {
  const IterationUtils: IterationUtilities = {
    MAX_ITERATION_COUNT: 300,

    eachDone<T>(array: T[], iterator: (value: T, callback: IterationDoneCallback) => unknown, callback: IterationCallback): unknown {
      const count = array.length;
      if (!count) return callback();

      let index = 0;
      const iterate = (): unknown =>
        iterator(array[index++], (error, done) => {
          if (error || index >= count || done) return callback(error);
          return index && index % IterationUtils.MAX_ITERATION_COUNT === 0 ? nextTick(iterate) : iterate();
        });
      return iterate();
    },

    each<T>(array: T[], iterator: (value: T, callback: IterationCallback) => unknown, callback: IterationCallback): unknown {
      const count = array.length;
      if (!count) return callback();

      let index = 0;
      const iterate = (): unknown =>
        iterator(array[index++], (error) => {
          if (error || index >= count) return callback(error);
          return index && index % IterationUtils.MAX_ITERATION_COUNT === 0 ? nextTick(iterate) : iterate();
        });
      return iterate();
    },

    popEach<T>(array: T[], iterator: (value: T, callback: IterationCallback) => unknown, callback: IterationCallback): unknown {
      const count = array.length;
      if (!count) return callback();

      let index = 0;
      const iterate = (): unknown => {
        index += 1;
        return iterator(array.pop() as T, (error) => {
          if (error || index >= count || array.length === 0) return callback(error);
          return index && index % IterationUtils.MAX_ITERATION_COUNT === 0 ? nextTick(iterate) : iterate();
        });
      };
      return iterate();
    },
  };

  return IterationUtils;
}
