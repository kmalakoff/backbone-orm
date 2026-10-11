'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const order = process.argv[2];
if (order !== 'root-first' && order !== 'umd-first') throw new Error(`Unexpected load order: ${String(order)}`);

function save(model) {
  return new Promise((resolve, reject) => model.save((error, value) => (error ? reject(error) : resolve(value))));
}

function count(cursor) {
  return new Promise((resolve, reject) => cursor.count((error, value) => (error ? reject(error) : resolve(value))));
}

function observeUtils(runtime) {
  const Utils = runtime.Utils;
  const instance = new Utils();
  return {
    callReturnsUndefined: Utils() === undefined,
    constructorIdentity: instance.constructor === Utils,
    instanceOf: instance instanceof Utils,
    name: Utils.name,
    ownKeys: Object.keys(instance),
    staticMethods: {
      configureModelType: typeof Utils.configureModelType,
      patchRemove: typeof Utils.patchRemove,
      updateOrNew: typeof Utils.updateOrNew,
    },
  };
}

async function main() {
  const first = order === 'root-first' ? require('backbone-orm') : require('backbone-orm/umd');
  const Backbone = require('backbone');
  const underscore = require('underscore');
  const packageRoot = path.dirname(require.resolve('backbone-orm/package.json'));
  const physicalUMD = path.join(packageRoot, 'backbone-orm.js');
  const collectionPrototype = Backbone.Collection.prototype;
  const initialFetch = collectionPrototype.fetch;
  const initialPrepareModel = collectionPrototype._prepareModel;
  const poolEntries = [];
  first.ConnectionPool.forEach((value, key) => poolEntries.push([key, value]));
  const initial = {
    collectionOriginalsMissing: collectionPrototype._orm_original_fns === undefined,
    legacyBundleMissingFromCache: require.cache[physicalUMD] === undefined,
    modelCache: {
      caches: Object.keys(first.model_cache.caches),
      enabled: first.model_cache.enabled,
      options: {
        ...first.model_cache.options,
        modelTypes: { ...first.model_cache.options.modelTypes },
      },
      verbose: first.model_cache.verbose,
    },
    naming: {
      focusModel: first.naming_conventions.modelName('focus'),
      focusTable: first.naming_conventions.tableName('Focus'),
      octopusPlural: first.naming_conventions.attribute('Octopus', true),
    },
    patchMissingReturn: collectionPrototype._removeModels.call(new Backbone.Collection(), [{ id: 'missing' }], {}),
    poolEntries,
  };

  const sentinel = { order };
  const customNaming = {
    attribute: (value) => `attribute:${value}`,
    foreignKey: (value) => `foreign:${value}`,
    modelName: (value) => `model:${value}`,
    tableName: (value) => `table:${value}`,
  };
  first.ConnectionPool.set('load-order', sentinel);
  first.configure({ model_cache: { enabled: true, max: 10 }, naming_conventions: customNaming });

  const rootCJS = require('backbone-orm');
  const umdCJS = require('backbone-orm/umd');
  const rootESMModule = await import('backbone-orm');
  const umdESMModule = await import('backbone-orm/umd');
  const rootESM = rootESMModule.default;
  const umdESM = umdESMModule.default;
  const runtimes = [rootCJS, umdCJS, rootESM, umdESM];

  const statePreserved = {
    cacheEnabled: rootESM.model_cache.enabled === true,
    cacheMax: rootESM.model_cache.options.max === 10,
    naming: rootESM.naming_conventions === customNaming,
    poolEntry: rootESM.ConnectionPool.get('load-order') === sentinel,
  };
  first.configure({ naming_conventions: 'default' });

  let Parent;
  let Child;
  const prefix = order === 'root-first' ? 'ColdRootFirst' : 'ColdUmdFirst';
  Parent = Backbone.Model.extend({
    model_name: `${prefix}Parent`,
    schema() {
      return { children: () => ['hasMany', Child, { as: 'parent' }] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: `${prefix}Child`,
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
    },
  });
  first.configureModel(Parent);
  first.configureModel(Child);
  const children = [new Child({ rank: 1 }), new Child({ rank: 2 })];
  for (const child of children) await save(child);
  const parent = new Parent({ children });
  await save(parent);
  const relationCount = await count(Parent.relation('children').cursor(parent, 'children'));
  const originals = collectionPrototype._orm_original_fns;

  const output = {
    initial,
    identity: {
      allRuntimeEntries: runtimes.every((runtime) => runtime === first),
      backbone: first.Backbone === Backbone && first.modules.backbone === Backbone,
      configureModel: rootESMModule.configureModel === first.configureModel && umdESMModule.configureModel === first.configureModel,
      connectionPool: runtimes.every((runtime) => runtime.ConnectionPool === first.ConnectionPool),
      modelCache: runtimes.every((runtime) => runtime.model_cache === first.model_cache),
      modules: runtimes.every((runtime) => runtime.modules === first.modules),
      underscore: first._ === underscore && first.modules.underscore === underscore,
      utils: runtimes.every((runtime) => runtime.Utils === first.Utils),
      utilsPatchRemove: runtimes.every((runtime) => runtime.Utils.patchRemove === first.Utils.patchRemove),
    },
    providers: {
      inflection: first.modules.inflection.version,
      lruCache: require('lru-cache/package.json').version,
    },
    collectionOwnership: {
      fetchOwned: collectionPrototype.fetch !== initialFetch,
      originalsCaptured: originals.fetch === initialFetch && originals._prepareModel === initialPrepareModel,
      prepareModelOwned: collectionPrototype._prepareModel !== initialPrepareModel,
    },
    persistence: {
      childCache: children.every((child) => Child.cache.get(child.id) === child),
      parentCache: Parent.cache.get(parent.id) === parent,
      relationCount,
    },
    resolution: {
      legacyBundleMissingFromCache: require.cache[physicalUMD] === undefined,
      umdNodeWrapper: require.resolve('backbone-orm/umd').endsWith(`${path.sep}nodeUmd.js`),
    },
    statePreserved,
    umdSha256: createHash('sha256').update(readFileSync(physicalUMD)).digest('hex'),
    utils: {
      rootCJS: observeUtils(rootCJS),
      rootESM: observeUtils(rootESM),
      umdCJS: observeUtils(umdCJS),
      umdESM: observeUtils(umdESM),
    },
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
