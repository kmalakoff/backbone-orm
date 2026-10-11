import assert from 'assert';

import ORM from 'backbone-orm';

const iteration = ORM.Utils;

describe('IterationUtils', () => {
  it('preserves callback return values and serial ordering', () => {
    const order: number[] = [];
    const result = iteration.each(
      [1, 2, 3],
      (value, next) => {
        order.push(value);
        return next();
      },
      () => 'finished'
    );

    assert.strictEqual(result, 'finished');
    assert.deepStrictEqual(order, [1, 2, 3]);
    assert.strictEqual(
      iteration.each(
        [],
        () => undefined,
        () => 'empty'
      ),
      'empty'
    );
  });

  it('stops eachDone early and preserves the exact error', () => {
    const failure = new Error('iteration failed');
    const visited: number[] = [];
    let observed: unknown;
    const errorReturn = iteration.each(
      [1, 2, 3],
      (value, next) => {
        visited.push(value);
        return next(value === 2 ? failure : null);
      },
      (error) => {
        observed = error;
        return 'error-return';
      }
    );
    assert.strictEqual(errorReturn, 'error-return');
    assert.strictEqual(observed, failure);
    assert.deepStrictEqual(visited, [1, 2]);

    visited.length = 0;
    const doneReturn = iteration.eachDone(
      [1, 2, 3],
      (value, next) => {
        visited.push(value);
        return next(null, value === 2);
      },
      () => 'done-return'
    );
    assert.strictEqual(doneReturn, 'done-return');
    assert.deepStrictEqual(visited, [1, 2]);
  });

  it('pops in reverse order and mutates the supplied array', () => {
    const values = [1, 2, 3];
    const visited: number[] = [];
    const result = iteration.popEach(
      values,
      (value, next) => {
        visited.push(value);
        return next();
      },
      () => 'popped'
    );
    assert.strictEqual(result, 'popped');
    assert.deepStrictEqual(visited, [3, 2, 1]);
    assert.deepStrictEqual(values, []);
  });

  it('yields every 300 items and completes a large synchronous workload without growing the stack', async () => {
    const values = Array.from({ length: 30_001 }, (_value, index) => index);
    let visited = 0;
    const completion = new Promise<void>((resolve, reject) => {
      const result = iteration.each(
        values,
        (_value, next) => {
          visited += 1;
          return next();
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
      assert.strictEqual(result, undefined);
    });

    assert.strictEqual(visited, 300);
    await completion;
    assert.strictEqual(visited, values.length);
  });
});
