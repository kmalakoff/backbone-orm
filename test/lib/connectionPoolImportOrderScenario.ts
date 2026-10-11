type Dynamic = any;

interface RetainedPoolSnapshot {
  cache: Dynamic;
  installedAdditiveMethods: Dynamic[];
  installedSynchronousMethods: Dynamic[];
  methods: Dynamic[];
  prototype: Dynamic;
}

export default async function observeConnectionPoolImportOrder(
  retained: Dynamic,
  first: Dynamic,
  second: Dynamic,
  value: Dynamic,
  retainedSnapshot: RetainedPoolSnapshot
): Promise<Record<string, unknown>> {
  const pool = retained.ConnectionPool;
  const synchronousKeys = ['set', 'get', 'destroy', 'del', 'reset', 'forEach'];
  const firstAdditiveMethods = retainedSnapshot.installedAdditiveMethods;
  const firstSynchronousMethods = retainedSnapshot.installedSynchronousMethods;
  let disposerCalls = 0;
  const owned = { id: 'owned' };
  first.ConnectionPool.setOwned('owned', owned, (_value: Dynamic, callback: (error?: Error | null) => void) => {
    disposerCalls += 1;
    callback(null);
  });
  await second.ConnectionPool.dispose('owned');

  return {
    additiveMethodsShared: firstAdditiveMethods.every((method, index) => method === [second.ConnectionPool.setOwned, second.ConnectionPool.dispose, second.ConnectionPool.disposeAll][index]),
    cacheIdentityPreserved: pool.cache === retainedSnapshot.cache,
    disposerCalls,
    entriesPreserved: pool.get('before-install') === value,
    ownedDelUsesMemoryStorePrototype: pool.del === first.MemoryStore.prototype.del,
    ownedRemovedAcrossFormats: pool.get('owned') === undefined,
    poolIdentityShared: first.ConnectionPool === pool && second.ConnectionPool === pool,
    prototypeIdentityPreserved: Object.getPrototypeOf(pool) === retainedSnapshot.prototype,
    runtimeIdentityShared: first === second,
    synchronousMethodsOwned: firstSynchronousMethods.every((method, index) => method !== retainedSnapshot.methods[index]),
    synchronousMethodsShared: firstSynchronousMethods.every((method, index) => method === synchronousKeys.map((key) => second.ConnectionPool[key])[index]),
    synchronousMethodsStable: firstSynchronousMethods.every((method, index) => method === retainedSnapshot.methods[index]),
  };
}
