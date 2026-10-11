import { spawnSync } from 'node:child_process';
import assert from 'assert';

import ORM, { type ConnectionDisposer, type ConnectionPoolInstance } from 'backbone-orm';

function readInvalidCachePreflight(cacheMethod: 'forEach' | 'get'): Record<string, unknown> {
  const script = `
    const installOwnedConnectionPool = require('./src/connection/ConnectionPool.ts').default;
    const cache = {
      del() {}, forEach() {}, get() {}, has() { return false; }, peek() {}, reset() {}, set() {}
    };
    delete cache[${JSON.stringify(cacheMethod)}];
    const pool = {
      cache, del() {}, destroy() {}, forEach() {}, get() {}, reset() {}, set() {}
    };
    const cacheEntries = Object.entries(cache);
    const poolEntries = Object.entries(pool);
    let error;
    try { installOwnedConnectionPool(pool); } catch (caught) { error = caught.message; }
    process.stdout.write(JSON.stringify({
      cacheUnchanged: cacheEntries.every(([key, value]) => cache[key] === value) && Object.keys(cache).length === cacheEntries.length,
      error,
      poolUnchanged: poolEntries.every(([key, value]) => pool[key] === value) && Object.keys(pool).length === poolEntries.length
    }));
  `;
  const result = spawnSync(process.execPath, ['--require', 'ts-swc-loaders', '--eval', script], { cwd: process.cwd(), encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function createPool(): ConnectionPoolInstance {
  ORM.ConnectionPool.reset();
  return ORM.ConnectionPool;
}

describe('owned ConnectionPool', () => {
  for (const missing of ['get', 'forEach'] as const) {
    it(`rejects a cache missing ${missing} before mutation`, () => {
      assert.deepStrictEqual(readInvalidCachePreflight(missing), {
        cacheUnchanged: true,
        error: `Invalid ConnectionPool: missing ${missing}`,
        poolUnchanged: true,
      });
    });
  }

  it('owns the synchronous methods with MemoryStore binding and alias behavior', () => {
    const pool = createPool();
    const MemoryStore = ORM.MemoryStore as {
      prototype: Record<'del' | 'destroy' | 'forEach' | 'get' | 'reset' | 'set', (...arguments_: never[]) => unknown>;
    };
    const methods = ['set', 'get', 'destroy', 'del', 'reset', 'forEach'] as const;
    const identities = methods.map((key) => pool[key]);

    assert.strictEqual(pool.del, MemoryStore.prototype.del);
    for (const key of ['set', 'get', 'destroy', 'reset', 'forEach'] as const) assert.notStrictEqual(pool[key], MemoryStore.prototype[key]);
    for (const key of methods) assert.notStrictEqual(Object.getOwnPropertyDescriptor(pool, key), undefined);

    const value = { id: 'detached' };
    const detachedSet = pool.set;
    const detachedGet = pool.get;
    const detachedDestroy = pool.destroy;
    const detachedReset = pool.reset;
    const detachedForEach = pool.forEach;
    assert.strictEqual(detachedSet('detached', value), pool);
    assert.strictEqual(detachedGet('detached'), value);
    assert.strictEqual(detachedDestroy('detached'), pool);
    assert.strictEqual(detachedReset(), pool);
    assert.strictEqual(
      detachedForEach(() => undefined),
      undefined
    );
    assert.throws(() => {
      const detachedDel = pool.del;
      detachedDel('missing');
    }, TypeError);
    assert.deepStrictEqual(
      methods.map((key) => pool[key]),
      identities
    );
  });

  it('preserves synchronous callbacks, returns, iteration, and never-cache behavior through the public package', () => {
    const pool = createPool();
    const events: string[] = [];
    const value = { id: 'first' };

    events.push('before-set');
    assert.strictEqual(
      pool.set('first', value, (error, stored) => {
        assert.strictEqual(error, null);
        assert.strictEqual(stored, value);
        events.push('set-callback');
      }),
      pool
    );
    events.push('after-set');
    assert.strictEqual(
      pool.get('first', (error, stored) => {
        assert.strictEqual(error, null);
        assert.strictEqual(stored, value);
        events.push('get-callback');
      }),
      value
    );
    events.push('after-get');

    pool.set('iteration-a', { id: 'a' });
    pool.set('iteration-b', { id: 'b' });
    const iteration: Array<{ cacheIdentity: boolean; id: unknown; key: unknown }> = [];
    assert.strictEqual(
      pool.forEach(function (this: unknown, stored, key, cache) {
        iteration.push({ cacheIdentity: this === cache && cache === pool.cache, id: (stored as { id?: unknown }).id, key });
      }),
      undefined
    );
    assert.deepStrictEqual(iteration, [
      { cacheIdentity: true, id: 'b', key: 'iteration-b' },
      { cacheIdentity: true, id: 'a', key: 'iteration-a' },
      { cacheIdentity: true, id: 'first', key: 'first' },
    ]);

    assert.strictEqual(
      pool.destroy('first', () => {
        events.push('destroy-callback');
      }),
      pool
    );
    events.push('after-destroy');
    assert.strictEqual(
      pool.del('iteration-a', () => {
        events.push('del-callback');
      }),
      pool
    );
    events.push('after-del');

    const never = { _orm_never_cache: true, id: 'never' };
    assert.strictEqual(
      pool.set('never-truthy', never, (error, stored) => {
        assert.strictEqual(error, null);
        assert.strictEqual(stored, never);
        return 'never-result';
      }),
      'never-result'
    );
    assert.strictEqual(
      pool.set('never-falsy', never, () => undefined),
      pool
    );
    assert.strictEqual(pool.get('never-truthy'), undefined);
    assert.strictEqual(pool.get('never-falsy'), undefined);

    assert.strictEqual(
      pool.reset(() => {
        events.push('reset-callback');
      }),
      pool
    );
    events.push('after-reset');
    assert.deepStrictEqual(events, ['before-set', 'set-callback', 'after-set', 'get-callback', 'after-get', 'destroy-callback', 'after-destroy', 'del-callback', 'after-del', 'reset-callback', 'after-reset']);
  });

  it('registers exact value and disposer identities', async () => {
    const pool = createPool();
    const connection = { id: 'first' };
    const disposer: ConnectionDisposer<typeof connection> = (_value, callback) => callback(null);

    assert.strictEqual(pool.setOwned('first', connection, disposer), pool);
    assert.strictEqual(pool.setOwned('first', connection, disposer), pool);
    assert.strictEqual(pool.get('first'), connection);
    assert.throws(() => pool.setOwned('first', connection, (_value, callback) => callback(null)), /different disposer/);
    assert.throws(() => pool.setOwned('first', { id: 'replacement' }, (_value, callback) => callback(null)), /already registered/);

    await pool.dispose('first');
    assert.strictEqual(pool.get('first'), undefined);
  });

  it('rejects an unowned disposeAll snapshot before any teardown starts', async () => {
    const pool = createPool();
    const owned = { id: 'owned' };
    let calls = 0;
    pool.setOwned('owned', owned, (_value, callback) => {
      calls += 1;
      callback(null);
    });
    pool.set('unowned', { id: 'unowned' });

    await assert.rejects(pool.disposeAll(), /entry is not owned/);
    assert.strictEqual(calls, 0);
    assert.strictEqual(pool.get('owned'), owned);
    assert.deepStrictEqual(pool.get('unowned'), { id: 'unowned' });
  });

  it('detaches ownership on every legacy replacement and removal without disposal', async () => {
    const pool = createPool();
    const oldConnection = { id: 'old' };
    const replacement = { id: 'replacement' };
    let calls = 0;
    const disposer: ConnectionDisposer<typeof oldConnection> = (_value, callback) => {
      calls += 1;
      callback(null);
    };

    pool.setOwned('set', oldConnection, disposer);
    pool.set('set', replacement);
    await assert.rejects(pool.dispose('set'), /entry is not owned/);
    assert.strictEqual(pool.get('set'), replacement);

    pool.setOwned('destroy', oldConnection, disposer);
    pool.destroy('destroy');
    await pool.dispose('destroy');

    pool.setOwned('del', oldConnection, disposer);
    pool.del('del');
    await pool.dispose('del');

    pool.setOwned('reset', oldConnection, disposer);
    pool.reset();
    await pool.dispose('reset');

    assert.strictEqual(calls, 0);
    assert.strictEqual(pool.get('set'), undefined);
  });

  it('shares one in-flight disposal and cannot erase a later registration', async () => {
    const pool = createPool();
    const oldConnection = { id: 'old' };
    const newConnection = { id: 'new' };
    let oldDone: ((error?: Error | null) => void) | undefined;
    let oldCalls = 0;
    let newCalls = 0;
    pool.setOwned('connection', oldConnection, (_value, callback) => {
      oldCalls += 1;
      oldDone = callback;
    });

    const promiseResult = pool.dispose('connection');
    const callbackResult = new Promise<void>((resolve, reject) => {
      const result = pool.dispose('connection', (error) => (error ? reject(error) : resolve()));
      assert.strictEqual(result, undefined);
    });
    assert.strictEqual(oldCalls, 1);

    pool.set('connection', newConnection);
    pool.setOwned('connection', newConnection, (_value, callback) => {
      newCalls += 1;
      callback(null);
    });
    oldDone?.(null);
    await Promise.all([promiseResult, callbackResult]);

    assert.strictEqual(pool.get('connection'), newConnection);
    assert.strictEqual(newCalls, 0);
    await pool.dispose('connection');
    assert.strictEqual(newCalls, 1);
  });

  it('keeps a replacement registered reentrantly by its own disposer', async () => {
    const pool = createPool();
    const original = { id: 'original' };
    const replacement = { id: 'replacement' };
    let replacementCalls = 0;
    const replacementDisposer: ConnectionDisposer<typeof replacement> = (_value, callback) => {
      replacementCalls += 1;
      callback(null);
    };
    pool.setOwned('connection', original, (_value, callback) => {
      pool.set('connection', replacement);
      pool.setOwned('connection', replacement, replacementDisposer);
      callback(null);
    });

    await pool.dispose('connection');
    assert.strictEqual(pool.get('connection'), replacement);
    assert.strictEqual(replacementCalls, 0);
    await pool.dispose('connection');
    assert.strictEqual(replacementCalls, 1);
    assert.strictEqual(pool.get('connection'), undefined);
  });

  it('allows an owned disposer to remove its own key', async () => {
    const pool = createPool();
    const connection = { id: 'removed' };
    let calls = 0;
    pool.setOwned('connection', connection, (_value, callback) => {
      calls += 1;
      pool.del('connection');
      callback(null);
    });

    await pool.dispose('connection');
    assert.strictEqual(calls, 1);
    assert.strictEqual(pool.get('connection'), undefined);
  });

  it('keeps a same-value registration created reentrantly by its old disposer', async () => {
    const pool = createPool();
    const connection = { id: 'same-value' };
    let replacementCalls = 0;
    const replacementDisposer: ConnectionDisposer<typeof connection> = (_value, callback) => {
      replacementCalls += 1;
      callback(null);
    };
    pool.setOwned('connection', connection, (_value, callback) => {
      pool.del('connection');
      pool.setOwned('connection', connection, replacementDisposer);
      callback(null);
    });

    await pool.dispose('connection');
    assert.strictEqual(pool.get('connection'), connection);
    assert.strictEqual(replacementCalls, 0);
    await pool.dispose('connection');
    assert.strictEqual(replacementCalls, 1);
    assert.strictEqual(pool.get('connection'), undefined);
  });

  it('retains a failed entry and reports the original cause without an automatic retry', async () => {
    const pool = createPool();
    const connection = { id: 'failing' };
    const failure = new Error('driver close failed');
    let calls = 0;
    pool.setOwned('failing', connection, (_value, callback) => {
      calls += 1;
      callback(failure);
    });

    await assert.rejects(pool.dispose('failing'), (error) => error === failure);
    assert.strictEqual(calls, 1);
    assert.strictEqual(pool.get('failing'), connection);
    await Promise.resolve();
    assert.strictEqual(calls, 1);

    await assert.rejects(pool.dispose('failing'), (error) => error === failure);
    assert.strictEqual(calls, 2);
  });

  it('settles every disposeAll worker and reports the first failure in snapshot order', async () => {
    const pool = createPool();
    const completions = new Map<string, (error?: Error | null) => void>();
    const calls: string[] = [];
    for (const key of ['first', 'second']) {
      pool.setOwned(key, { id: key }, (_value, callback) => {
        calls.push(key);
        completions.set(key, callback);
      });
    }

    const firstFailure = new Error('first failed');
    const secondFailure = new Error('second failed');
    let settled = false;
    const disposal = pool.disposeAll().finally(() => {
      settled = true;
    });
    assert.deepStrictEqual(calls, ['second', 'first']);

    completions.get('first')?.(firstFailure);
    await Promise.resolve();
    assert.strictEqual(settled, false);
    completions.get('second')?.(secondFailure);
    await assert.rejects(disposal, (error) => error === secondFailure);
    assert.strictEqual(pool.get('first') !== undefined, true);
    assert.strictEqual(pool.get('second') !== undefined, true);
  });

  it('shares in-flight work across concurrent disposeAll callers', async () => {
    const pool = createPool();
    let calls = 0;
    let finish: ((error?: Error | null) => void) | undefined;
    pool.setOwned('shared', { id: 'shared' }, (_value, callback) => {
      calls += 1;
      finish = callback;
    });

    const promiseResult = pool.disposeAll();
    const callbackResult = new Promise<void>((resolve, reject) => {
      const result = pool.disposeAll((error) => (error ? reject(error) : resolve()));
      assert.strictEqual(result, undefined);
    });
    assert.strictEqual(calls, 1);
    finish?.(null);
    await Promise.all([promiseResult, callbackResult]);
    assert.strictEqual(pool.get('shared'), undefined);
  });

  it('excludes registrations made after a disposeAll snapshot', async () => {
    const pool = createPool();
    let finish: ((error?: Error | null) => void) | undefined;
    const first = { id: 'first' };
    const later = { id: 'later' };
    pool.setOwned('first', first, (_value, callback) => {
      finish = callback;
    });

    const disposal = pool.disposeAll();
    pool.setOwned('later', later, (_value, callback) => callback(null));
    finish?.(null);
    await disposal;

    assert.strictEqual(pool.get('first'), undefined);
    assert.strictEqual(pool.get('later'), later);
  });

  it('disposes the captured owner when an earlier snapshot entry replaces its key', async () => {
    const pool = createPool();
    const oldConnection = { id: 'old-b' };
    const replacement = { id: 'replacement-b' };
    const calls: string[] = [];
    pool.setOwned('b', oldConnection, (_value, callback) => {
      calls.push('old-b');
      callback(null);
    });
    pool.setOwned('a', { id: 'a' }, (_value, callback) => {
      calls.push('a');
      pool.set('b', replacement);
      pool.setOwned('b', replacement, (_replacement, replacementCallback) => {
        calls.push('new-b');
        replacementCallback(null);
      });
      callback(null);
    });

    await pool.disposeAll();
    assert.deepStrictEqual(calls, ['a', 'old-b']);
    assert.strictEqual(pool.get('a'), undefined);
    assert.strictEqual(pool.get('b'), replacement);

    await pool.disposeAll();
    assert.deepStrictEqual(calls, ['a', 'old-b', 'new-b']);
    assert.strictEqual(pool.get('b'), undefined);
  });

  it('starts every disposeAll worker before reporting a synchronous post-callback throw', async () => {
    const pool = createPool();
    const failure = new Error('throw after callback');
    const calls: string[] = [];
    let finishPending: ((error?: Error | null) => void) | undefined;
    pool.setOwned('pending', { id: 'pending' }, (_value, callback) => {
      calls.push('pending');
      finishPending = callback;
    });
    pool.setOwned('throwing', { id: 'throwing' }, (_value, callback) => {
      calls.push('throwing');
      callback(null);
      throw failure;
    });

    let settled = false;
    const disposal = pool.disposeAll().finally(() => {
      settled = true;
    });
    assert.deepStrictEqual(calls, ['throwing', 'pending']);
    await Promise.resolve();
    assert.strictEqual(settled, false);

    finishPending?.(null);
    await assert.rejects(disposal, (error) => error === failure);
    assert.strictEqual(pool.get('throwing') !== undefined, true);
    assert.strictEqual(pool.get('pending'), undefined);
  });

  it('reports falsy thrown disposer values as errors with their exact causes', async () => {
    for (const cause of [undefined, null, false, 0, '']) {
      const pool = createPool();
      const connection = { cause };
      pool.setOwned('connection', connection, (_value, callback) => {
        callback(null);
        throw cause;
      });

      await assert.rejects(pool.dispose('connection'), (error: Error & { cause?: unknown }) => error instanceof Error && error.cause === cause);
      assert.strictEqual(pool.get('connection'), connection);
    }
  });

  it('settles concurrent observers without routing a callback exception back through disposal', async () => {
    const pool = createPool();
    const callbackFailure = new Error('consumer callback failed');
    let finish: ((error?: Error | null) => void) | undefined;
    pool.setOwned('callback', { id: 'callback' }, (_value, callback) => {
      finish = callback;
    });

    pool.dispose('callback', () => {
      throw callbackFailure;
    });
    const concurrent = pool.dispose('callback');
    assert.throws(
      () => finish?.(null),
      (error) => error === callbackFailure
    );
    await concurrent;
    assert.strictEqual(pool.get('callback'), undefined);
  });
});
