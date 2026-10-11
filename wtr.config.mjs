import { mkdirSync, mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeRmSync } from 'fs-remove-compat';
import createConfig from 'tsds-web-test-runner/createConfig.mjs';

const require = createRequire(import.meta.url);
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(path.join(repoRoot, '.tmp'), { recursive: true });
const firefoxAppDataRoot = mkdtempSync(path.join(repoRoot, '.tmp', 'wtr-firefox-appdata-'));
process.once('exit', () => safeRmSync(firefoxAppDataRoot, { recursive: true, force: true }));

function localPackageURL(specifier) {
  const relativePath = path.relative(process.cwd(), require.resolve(specifier));
  return `/${relativePath.split(path.sep).join('/')}`;
}

function localFileURL(filename) {
  const relativePath = path.relative(process.cwd(), filename);
  return `/${relativePath.split(path.sep).join('/')}`;
}

const underscoreURL = localPackageURL('underscore/underscore-umd.js');
const backboneURL = localPackageURL('backbone');
const packageRoot = path.dirname(require.resolve('backbone-orm/package.json'));
const retainedRuntimeURL = localFileURL(path.join(packageRoot, 'backbone-orm.js'));

const config = createConfig({
  concurrency: 1,
  concurrentBrowsers: 1,
  testRunnerHtml: (testFramework) => `<!doctype html>
    <html>
      <body>
        <script src="${underscoreURL}"></script>
        <script src="${backboneURL}"></script>
        <script src="${retainedRuntimeURL}"></script>
        <script>
          function relationConstructors(ORM, prefix) {
            var Parent;
            var Child;
            var Profile;
            Parent = Backbone.Model.extend({
              model_name: prefix + 'Parent',
              schema: function () {
                return {
                  children: function () { return ['hasMany', Child, { as: 'parent' }]; },
                  profile: function () { return ['hasOne', Profile, { as: 'owner' }]; }
                };
              }
            });
            Child = Backbone.Model.extend({
              model_name: prefix + 'Child',
              schema: function () {
                return { parent: function () { return ['belongsTo', Parent, { as: 'children' }]; } };
              }
            });
            Profile = Backbone.Model.extend({
              model_name: prefix + 'Profile',
              schema: function () {
                return { owner: function () { return ['belongsTo', Parent, { as: 'profile' }]; } };
              }
            });
            Parent.prototype.sync = ORM.sync(Parent);
            Child.prototype.sync = ORM.sync(Child);
            Profile.prototype.sync = ORM.sync(Profile);
            var many = Parent.relation('children');
            var one = Parent.relation('profile');
            return {
              Many: many.constructor,
              One: one.constructor,
              Relation: Object.getPrototypeOf(many.constructor.prototype).constructor,
              Schema: Parent.schema().constructor
            };
          }

          function cacheConstructors(ORM, prefix) {
            ORM.configure({ model_cache: { enabled: true, max: 10 } });
            var Model = Backbone.Model.extend({
              model_name: prefix + 'CachedModel',
              schema: function () { return { name: 'String' }; }
            });
            Model.prototype.sync = ORM.sync(Model);
            var cacheSync = Model.prototype.sync('sync');
            var constructors = {
              CacheCursor: cacheSync.cursor({}).constructor,
              CacheSync: cacheSync.constructor,
              MemoryStore: Model.cache.constructor,
              MemorySync: cacheSync.wrapped_sync_fn('sync').constructor
            };
            ORM.configure({ model_cache: { enabled: false } });
            return constructors;
          }

          BackboneORM.configure({ model_cache: { enabled: false } });
          var retainedConnectionPoolValue = { id: 'retained-browser-connection' };
          BackboneORM.ConnectionPool.set('retained-browser-connection', retainedConnectionPoolValue);
          window.__captureCacheConstructors = cacheConstructors;
          window.__captureRelationConstructors = relationConstructors;
          window.__observeOwnedFind = async function (ORM, prefix) {
            var Model = Backbone.Model.extend({
              model_name: prefix + 'FindModel',
              schema: function () { return { name: 'String' }; }
            });
            var configured = ORM.configureModel(Model);
            var models = await configured.find();
            return {
              configuredIdentity: configured === Model,
              findIsOwn: Object.prototype.hasOwnProperty.call(configured, 'find'),
              modelCount: models.length
            };
          };
          window.__retainedOrmSnapshot = {
            BaseConvention: BackboneORM.BaseConvention,
            Backbone: Backbone,
            ConnectionPool: BackboneORM.ConnectionPool,
            DateUtils: BackboneORM.DateUtils,
            Fabricator: BackboneORM.Fabricator,
            JSONUtils: BackboneORM.JSONUtils,
            connectionPoolLegacyMethods: {
              del: BackboneORM.ConnectionPool.del,
              destroy: BackboneORM.ConnectionPool.destroy,
              forEach: BackboneORM.ConnectionPool.forEach,
              get: BackboneORM.ConnectionPool.get,
              reset: BackboneORM.ConnectionPool.reset,
              set: BackboneORM.ConnectionPool.set
            },
            connectionPoolValue: retainedConnectionPoolValue,
            Cursor: BackboneORM.Cursor,
            DatabaseURL: BackboneORM.DatabaseURL,
            MemoryCursor: BackboneORM.sync.Cursor,
            MemoryStore: BackboneORM.MemoryStore,
            MemorySync: BackboneORM.sync.Sync,
            Queue: BackboneORM.Queue,
            Schema: BackboneORM.Schema,
            TestUtils: BackboneORM.TestUtils,
            Utils: BackboneORM.Utils,
            configure: BackboneORM.configure,
            configureModelType: BackboneORM.Utils.configureModelType,
            findOrGenerateModelName: BackboneORM.Utils.findOrGenerateModelName,
            modelCache: BackboneORM.model_cache,
            modelCacheConfigure: BackboneORM.model_cache.configure,
            modelCacheConfigureSync: BackboneORM.model_cache.configureSync,
            modelCachePrototype: Object.getPrototypeOf(BackboneORM.model_cache),
            namingConvention: BackboneORM.naming_conventions,
            cacheConstructors: cacheConstructors(BackboneORM, 'RetainedBrowserBoundary'),
            relationConstructors: relationConstructors(BackboneORM, 'RetainedBrowserBoundary'),
            collectionMethods: {
              fetch: Backbone.Collection.prototype.fetch,
              prepareModel: Backbone.Collection.prototype._prepareModel
            },
            iterationMethods: {
              each: BackboneORM.Utils.each,
              eachC: BackboneORM.Utils.eachC,
              eachDone: BackboneORM.Utils.eachDone,
              eachDoneC: BackboneORM.Utils.eachDoneC,
              popEach: BackboneORM.Utils.popEach,
              popEachC: BackboneORM.Utils.popEachC
            },
            runtime: BackboneORM,
            scriptURLs: Array.from(document.scripts, function (script) { return script.src; }).filter(Boolean),
            sync: BackboneORM.sync
          };
        </script>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>`,
});

const runnerRequire = createRequire(require.resolve('tsds-web-test-runner/createConfig.mjs'));
const { playwrightLauncher } = runnerRequire('@web/test-runner-playwright');
// Gecko initializes app-data separately from its temporary profile. Keep that
// state in suite scratch so macOS app-data protection cannot target user Firefox.
config.browsers = config.browsers.map((browser) => (browser.name === 'Firefox' ? playwrightLauncher({ product: 'firefox', concurrency: 1, launchOptions: { headless: true, env: { ...process.env, MOZ_APP_DATA: firefoxAppDataRoot } } }) : browser));

export default config;
