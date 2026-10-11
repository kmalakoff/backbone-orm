type Dynamic = any;

function tag(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (value === Infinity) return 'Infinity';
  return `${typeof value}:${String(value)}`;
}

function observeQueue(ORM: Dynamic): Record<string, unknown> {
  const empty = new ORM.Queue();
  let emptyError: unknown = Symbol('unset');
  const emptyReturn = empty.await((error: unknown) => {
    emptyError = error;
    return 'empty-return';
  });

  const completed = new ORM.Queue();
  const completedDeferReturn = completed.defer((done: (error?: unknown) => unknown) => done());
  let completedError: unknown = Symbol('unset');
  const completedAwaitReturn = completed.await((error: unknown) => {
    completedError = error;
    return 'completed-return';
  });

  const order: string[] = [];
  const parallel = new ORM.Queue(2);
  const completions: Array<(error?: unknown) => unknown> = [];
  for (const name of ['first', 'second', 'third']) {
    parallel.defer((done: (error?: unknown) => unknown) => {
      order.push(`start-${name}`);
      completions.push(done);
    });
  }
  parallel.await((error: unknown) => {
    order.push(`await-${tag(error)}`);
    return 'parallel-return';
  });
  const parallelBefore = order.slice();
  const secondReturn = completions[1]();
  const parallelMiddle = order.slice();
  const firstReturn = completions[0]();
  const thirdReturn = completions[2]();

  const failure = new Error('queue failed');
  const failing = new ORM.Queue(1);
  const failedOrder: string[] = [];
  let fail: ((error?: unknown) => unknown) | undefined;
  let observedFailure: unknown;
  failing.defer((done: (error?: unknown) => unknown) => {
    failedOrder.push('first');
    fail = done;
  });
  failing.defer((_done: (error?: unknown) => unknown) => failedOrder.push('second'));
  failing.await((error: unknown) => {
    observedFailure = error;
    failedOrder.push('await');
    return 'failure-return';
  });
  const failureReturn = fail?.(failure);

  const throwing = new ORM.Queue();
  const thrown = new Error('task threw');
  let thrownIdentity = false;
  try {
    throwing.defer(() => {
      throw thrown;
    });
  } catch (error) {
    thrownIdentity = error === thrown;
  }

  const waiting = new ORM.Queue(1);
  waiting.defer(() => undefined);
  const firstAwait = () => undefined;
  waiting.await(firstAwait);
  let duplicateMessage: string | undefined;
  try {
    waiting.await(() => undefined);
  } catch (error) {
    duplicateMessage = (error as Error).message.replace(/function.*$/s, '<callback>');
  }

  return {
    constructorType: typeof ORM.Queue,
    defaults: [tag(new ORM.Queue().parallelism), tag(new ORM.Queue(0).parallelism), tag(new ORM.Queue(null).parallelism)],
    duplicateMessage,
    empty: { error: tag(emptyError), return: tag(emptyReturn) },
    completed: { awaitError: tag(completedError), awaitReturn: tag(completedAwaitReturn), deferReturn: tag(completedDeferReturn) },
    error: { identity: observedFailure === failure, order: failedOrder, return: tag(failureReturn) },
    parallel: {
      before: parallelBefore,
      firstReturn: tag(firstReturn),
      middle: parallelMiddle,
      secondReturn: tag(secondReturn),
      final: order,
      thirdReturn: tag(thirdReturn),
    },
    thrown: { identity: thrownIdentity, runningCount: throwing.running_count },
  };
}

async function observeIteration(ORM: Dynamic): Promise<Record<string, unknown>> {
  const Utils = ORM.Utils;
  const emptyReturn = Utils.each([], () => undefined, () => 'empty-return');
  const order: number[] = [];
  const eachReturn = Utils.each(
    [1, 2, 3],
    (value: number, next: (error?: unknown) => unknown) => {
      order.push(value);
      return next();
    },
    () => 'each-return'
  );

  const failure = new Error('iteration failed');
  const errorVisited: number[] = [];
  let observedFailure: unknown;
  const errorReturn = Utils.each(
    [1, 2, 3],
    (value: number, next: (error?: unknown) => unknown) => {
      errorVisited.push(value);
      return next(value === 2 ? failure : null);
    },
    (error: unknown) => {
      observedFailure = error;
      return 'error-return';
    }
  );

  const doneVisited: number[] = [];
  const doneReturn = Utils.eachDone(
    [1, 2, 3],
    (value: number, next: (error?: unknown, done?: boolean) => unknown) => {
      doneVisited.push(value);
      return next(null, value === 2);
    },
    () => 'done-return'
  );

  const popped = [1, 2, 3];
  const popVisited: number[] = [];
  const popReturn = Utils.popEach(
    popped,
    (value: number, next: (error?: unknown) => unknown) => {
      popVisited.push(value);
      return next();
    },
    () => 'pop-return'
  );

  const cOrder: string[] = [];
  const cReturn = Utils.eachC(
    ['a', 'b'],
    () => {
      cOrder.push('callback');
      return 'c-return';
    },
    (value: string, next: (error?: unknown) => unknown) => {
      cOrder.push(value);
      return next();
    }
  );

  const boundaryValues = Array.from({ length: 301 }, (_value, index) => index);
  let boundaryVisited = 0;
  let boundarySynchronous = 0;
  let boundaryReturn: unknown;
  const boundaryDone = new Promise<void>((resolve, reject) => {
    boundaryReturn = Utils.each(
      boundaryValues,
      (_value: number, next: (error?: unknown) => unknown) => {
        boundaryVisited += 1;
        return next();
      },
      (error: unknown) => {
        if (error) reject(error);
        else resolve();
      }
    );
    boundarySynchronous = boundaryVisited;
  });
  await boundaryDone;

  const largeValues = Array.from({ length: 30_001 }, (_value, index) => index);
  let largeVisited = 0;
  await new Promise<void>((resolve, reject) => {
    Utils.each(
      largeValues,
      (_value: number, next: (error?: unknown) => unknown) => {
        largeVisited += 1;
        return next();
      },
      (error: unknown) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });

  return {
    boundary: { return: tag(boundaryReturn), synchronous: boundarySynchronous, total: boundaryVisited },
    cStyle: { order: cOrder, return: tag(cReturn) },
    done: { order: doneVisited, return: tag(doneReturn) },
    each: { emptyReturn: tag(emptyReturn), order, return: tag(eachReturn) },
    error: { identity: observedFailure === failure, order: errorVisited, return: tag(errorReturn) },
    pop: { input: popped, order: popVisited, return: tag(popReturn) },
    stackSafeCount: largeVisited,
  };
}

function observeDates(ORM: Dynamic): Record<string, unknown> {
  const units = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
  let invalidMessage: string | undefined;
  try {
    ORM.DateUtils.durationAsMilliseconds(1, 'fortnights');
  } catch (error) {
    invalidMessage = (error as Error).message;
  }
  const early = { valueOf: () => 10 };
  const late = { valueOf: () => 20 };
  return {
    constructor: {
      instancePrototype: Object.getPrototypeOf(new ORM.DateUtils()) === ORM.DateUtils.prototype,
      type: typeof ORM.DateUtils,
    },
    comparisons: {
      after: ORM.DateUtils.isAfter(late, early),
      before: ORM.DateUtils.isBefore(early, late),
      equal: ORM.DateUtils.isEqual(new Date(10), early),
      nanEqual: ORM.DateUtils.isEqual(Number.NaN, Number.NaN),
    },
    durations: units.map((unitsName) => ORM.DateUtils.durationAsMilliseconds(2, unitsName)),
    invalidMessage,
  };
}

export default async function observeUtilityContract(ORM: Dynamic): Promise<Record<string, unknown>> {
  return {
    dates: observeDates(ORM),
    iteration: await observeIteration(ORM),
    queue: observeQueue(ORM),
  };
}
