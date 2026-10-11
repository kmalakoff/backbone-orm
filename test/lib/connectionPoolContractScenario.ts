type Dynamic = any;

function errorName(callback: () => unknown): string | undefined {
  try {
    callback();
  } catch (error) {
    return (error as Error).name;
  }
}

export default function observeConnectionPoolLegacyContract(ORM: Dynamic): Record<string, unknown> {
  const pool = ORM.ConnectionPool;
  pool.reset();
  const events: string[] = [];
  const callbacks: Record<string, unknown[]> = {};
  const first = { id: 'first', destroyCalls: 0, destroy() { this.destroyCalls += 1; } };
  const replacement = { id: 'replacement', destroyCalls: 0, destroy() { this.destroyCalls += 1; } };

  events.push('before-set');
  const setReturn = pool.set('first', first, (...arguments_: unknown[]) => {
    callbacks.set = arguments_;
    events.push('set-callback');
  });
  events.push('after-set');
  const getReturn = pool.get('first', (...arguments_: unknown[]) => {
    callbacks.get = arguments_;
    events.push('get-callback');
  });
  events.push('after-get');
  const replacementReturn = pool.set('first', replacement);

  const detachedSet = pool.set;
  const detachedGet = pool.get;
  const detachedDestroy = pool.destroy;
  const detachedReset = pool.reset;
  const detachedForEach = pool.forEach;
  detachedSet('detached', { id: 'detached' });
  const detachedValue = detachedGet('detached');
  const destroyReturn = detachedDestroy('detached', (...arguments_: unknown[]) => {
    callbacks.destroy = arguments_;
    events.push('destroy-callback');
  });
  events.push('after-destroy');
  const missingDestroyReturn = detachedDestroy('missing', (...arguments_: unknown[]) => {
    callbacks.missingDestroy = arguments_;
  });

  detachedSet('iteration-a', { id: 'a' });
  detachedSet('iteration-b', { id: 'b' });
  const iteration: Array<Record<string, unknown>> = [];
  const forEachReturn = detachedForEach(function (this: unknown, value: Dynamic, key: unknown, cache: unknown) {
    iteration.push({ cacheIdentity: this === cache && cache === pool.cache, id: value.id, key });
  });

  const resetReturn = detachedReset((...arguments_: unknown[]) => {
    callbacks.reset = arguments_;
    events.push('reset-callback');
  });
  events.push('after-reset');

  const never = { _orm_never_cache: true, id: 'never' };
  const neverTruthyReturn = pool.set('never-truthy', never, (...arguments_: unknown[]) => {
    callbacks.neverTruthy = arguments_;
    return 'never-result';
  });
  const neverFalsyReturn = pool.set('never-falsy', never, () => undefined);

  pool.set('alias', { id: 'alias' });
  const aliasReturn = pool.del('alias', (...arguments_: unknown[]) => {
    callbacks.del = arguments_;
  });
  const detachedDelError = errorName(() => {
    const detachedDel = pool.del;
    detachedDel('missing');
  });

  return {
    alias: {
      aliasReturnsPool: aliasReturn === pool,
      detachedDelError,
      instanceMethodsDiffer: pool.del !== pool.destroy,
      prototypeAliasShared: Object.getPrototypeOf(pool).del === Object.getPrototypeOf(pool).destroy,
    },
    callbacks: {
      del: callbacks.del,
      destroy: callbacks.destroy,
      get: [callbacks.get?.[0] ?? null, (callbacks.get?.[1] as Dynamic)?.id],
      missingDestroy: callbacks.missingDestroy,
      neverTruthy: [callbacks.neverTruthy?.[0] ?? null, (callbacks.neverTruthy?.[1] as Dynamic)?.id],
      reset: callbacks.reset,
      set: [callbacks.set?.[0] ?? null, (callbacks.set?.[1] as Dynamic)?.id],
    },
    events,
    iteration,
    legacyDisposal: {
      firstDestroyCalls: first.destroyCalls,
      replacementDestroyCalls: replacement.destroyCalls,
    },
    neverCache: {
      absent: pool.get('never-truthy') === undefined && pool.get('never-falsy') === undefined,
      falsyReturnsPool: neverFalsyReturn === pool,
      truthyReturn: neverTruthyReturn,
    },
    returns: {
      destroyReturnsPool: destroyReturn === pool,
      detachedValueId: detachedValue.id,
      forEachIsUndefined: forEachReturn === undefined,
      getReturnsValue: getReturn === first,
      missingDestroyReturnsPool: missingDestroyReturn === pool,
      replacementReturnsPool: replacementReturn === pool,
      resetReturnsPool: resetReturn === pool,
      setReturnsPool: setReturn === pool,
    },
  };
}
