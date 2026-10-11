import assert from 'assert';

import ORM from 'backbone-orm';

const Queue = ORM.Queue;

describe('Queue', () => {
  it('preserves synchronous callback arguments and callback returns', () => {
    const empty = new Queue();
    let emptyError: unknown = Symbol('unset');
    const emptyReturn = empty.await((error) => {
      emptyError = error;
      return 'empty-return';
    });
    assert.strictEqual(emptyError, null);
    assert.strictEqual(emptyReturn, 'empty-return');

    const completed = new Queue();
    completed.defer((done) => done());
    let completedError: unknown = Symbol('unset');
    const completedReturn = completed.await((error) => {
      completedError = error;
      return 'completed-return';
    });
    assert.strictEqual(completedError, undefined);
    assert.strictEqual(completedReturn, 'completed-return');
  });

  it('starts work in insertion order within the configured parallelism', () => {
    const queue = new Queue(2);
    const calls: string[] = [];
    const completions: Array<(error?: Error | null) => unknown> = [];
    for (const name of ['first', 'second', 'third']) {
      queue.defer((done) => {
        calls.push(`start-${name}`);
        completions.push(done);
      });
    }
    queue.await((error) => calls.push(error ? 'failed' : 'await'));

    assert.deepStrictEqual(calls, ['start-first', 'start-second']);
    completions[1]();
    assert.deepStrictEqual(calls, ['start-first', 'start-second', 'start-third']);
    completions[0]();
    completions[2]();
    assert.deepStrictEqual(calls, ['start-first', 'start-second', 'start-third', 'await']);
  });

  it('reports the first truthy error and does not launch queued work', () => {
    const queue = new Queue(1);
    const failure = new Error('queue failed');
    let finish: ((error?: Error | null) => unknown) | undefined;
    let secondStarted = false;
    let observed: unknown;
    queue.defer((done) => {
      finish = done;
    });
    queue.defer((_done) => {
      secondStarted = true;
    });
    queue.await((error) => {
      observed = error;
      return 'error-return';
    });

    assert.strictEqual(finish?.(failure), 'error-return');
    assert.strictEqual(observed, failure);
    assert.strictEqual(secondStarted, false);
  });

  it('throws task exceptions through and rejects a second awaiting callback', () => {
    const queue = new Queue();
    const failure = new Error('task threw');
    assert.throws(
      () =>
        queue.defer(() => {
          throw failure;
        }),
      (error) => error === failure
    );

    const waiting = new Queue(1);
    waiting.defer(() => undefined);
    const first = () => undefined;
    waiting.await(first);
    assert.throws(() => waiting.await(() => undefined), /^Error: Awaiting callback was added twice:/);
  });
});
