import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'assert';
import { safeRmSync } from 'fs-remove-compat';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scratchParent = path.join(repoRoot, '.tmp');
const tsds = createRequire(import.meta.url).resolve('ts-dev-stack/bin/cli.js');
const npmCli = process.env.npm_execpath;
const NODE_MODULE_MODES = { cjs: 'Node16', esm: 'NodeNext' } as const;
assert.ok(npmCli, 'Run packed consumer checks through the npm script');

function runNode(args: string[], cwd: string, label: string): string {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.stdout;
}

function writeConsumer(root: string, format: 'cjs' | 'esm', tarball: string): void {
  const type = format === 'cjs' ? 'commonjs' : 'module';
  const target = format;
  const nodeModule = NODE_MODULE_MODES[format];
  const packageJson = {
    name: `backbone-orm-packed-${format}-consumer`,
    private: true,
    type,
    source: 'src/index.ts',
    dependencies: {
      backbone: '1.6.1',
      'backbone-orm': `file:${tarball}`,
    },
    tsds: { targets: [target] },
  };
  const tsconfig = {
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      declaration: true,
      downlevelIteration: true,
      erasableSyntaxOnly: true,
      esModuleInterop: true,
      ignoreDeprecations: '6.0',
      lib: ['ES2020', 'DOM'],
      module: nodeModule,
      moduleResolution: nodeModule,
      outDir: 'dist',
      rewriteRelativeImportExtensions: true,
      skipLibCheck: false,
      strict: true,
      target: 'ES2019',
      types: [],
      verbatimModuleSyntax: format === 'esm',
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  };
  const typeSource =
    format === 'cjs'
      ? `import Backbone from 'backbone';\nimport ORM, { configureModel } from 'backbone-orm';\n\ninterface Attributes { name: string }\nclass NativeAuthor extends Backbone.Model<Attributes> {\n  static find(): string { return 'custom'; }\n  get model_name() { return 'PackedTypedCjsNativeAuthor'; }\n  schema() { return { name: 'String' }; }\n}\nconst direct = new ORM.sync.Sync(NativeAuthor);\nconst directType: typeof NativeAuthor = direct.model_type;\nconst schema = new ORM.Schema(NativeAuthor, { id: { type: 'String' } });\nconst columns: string[] = schema.columns();\nconst Author = configureModel(NativeAuthor);\nconst found: Promise<NativeAuthor[]> = Author.find({ name: 'Ada' });\nconst connection = { close(callback: (error?: Error | null) => void) { callback(null); } };\nORM.ConnectionPool.setOwned('packed-type', connection, (value, callback) => value.close(callback));\nconst uncheckedConnection: unknown = ORM.ConnectionPool.get('packed-type');\nconst disposed: Promise<void> = ORM.ConnectionPool.dispose('packed-type');\nvoid [directType, columns, found, uncheckedConnection, disposed, ORM];\n`
      : `import Backbone from 'backbone';\nimport ORM, { configureModel } from 'backbone-orm';\n\ninterface Attributes { name: string }\nclass NativeAuthor extends Backbone.Model<Attributes> {\n  static find(): string { return 'custom'; }\n  get model_name() { return 'PackedTypedEsmNativeAuthor'; }\n  schema() { return { name: 'String' }; }\n}\nconst direct = new ORM.sync.Sync(NativeAuthor);\nconst directType: typeof NativeAuthor = direct.model_type;\nconst schema = new ORM.Schema(NativeAuthor, { id: { type: 'String' } });\nconst columns: string[] = schema.columns();\nconst Author = configureModel(NativeAuthor);\nconst found: Promise<NativeAuthor[]> = Author.find({ name: 'Ada' });\nconst connection = { close(callback: (error?: Error | null) => void) { callback(null); } };\nORM.ConnectionPool.setOwned('packed-type', connection, (value, callback) => value.close(callback));\nconst uncheckedConnection: unknown = ORM.ConnectionPool.get('packed-type');\nconst disposed: Promise<void> = ORM.ConnectionPool.dispose('packed-type');\nvoid [directType, columns, found, uncheckedConnection, disposed, ORM];\n`;
  const rawTypeSource = `import Backbone from 'backbone';
import ORM from 'backbone-orm';

interface Attributes { name: string }
class RawModel extends Backbone.Model<Attributes> {
  get model_name() { return 'PackedRawModel'; }
  schema() { return { name: 'String' }; }
}
const raw = new ORM.sync.Sync(RawModel);
raw.initialize();
raw.get(1);
raw.indexOf(1);
raw.insertIndexOf(1);
raw.read(new RawModel(), { success(value) { return value; }, error(error) { return error; } });
raw.create(new RawModel(), { success(value) { return value; }, error(error) { return error; } });
raw.update(new RawModel(), { success(value) { return value; }, error(error) { return error; } });
raw.delete(new RawModel(), { success(value) { return value; }, error(error) { return error; } });
raw.deleteCB(new RawModel(), (error) => error);
raw.resetSchema({}, (error) => error);
raw.destroy((error) => error);
raw.destroy({}, (error) => error);
raw.cursor().limit(1).toJSON((error, rows) => [error, rows]);
raw.cursor({}).toJSON((error, result) => {
  if (error) return error;
  if (Array.isArray(result)) return result[0];
  if (typeof result === 'number') return result.toFixed();
  if (result && typeof result === 'object' && 'id' in result) return result.id;
  return result;
});
`;
  const runtimeSource =
    format === 'cjs'
      ? `const assert = require('assert');\nconst Backbone = require('backbone');\nconst ORM = require('backbone-orm');\nconst NodeUMD = require('backbone-orm/umd');\nassert.strictEqual(NodeUMD, ORM);\nassert.strictEqual(ORM.Backbone, Backbone);\nassert.strictEqual(typeof ORM.sync, 'function');\nassert.strictEqual(typeof ORM.Schema, 'function');\nassert.strictEqual(typeof ORM.Utils.configureModelType, 'function');\nORM.configure({ model_cache: { enabled: true, max: 100 } });\nclass Parent extends Backbone.Model { get model_name() { return 'PackedCjsParent'; } schema() { return { parent_value: 'String' }; } }\nconst direct = new ORM.sync.Sync(Parent);\nassert.strictEqual(direct.model_type, Parent);\nconst directSchema = new ORM.Schema(Parent);\ndirectSchema.initialize();\nassert.deepStrictEqual(directSchema.columns(), ['parent_value', 'id']);\nORM.configureModel(Parent);\nclass Child extends Parent { get model_name() { return 'PackedCjsChild'; } schema() { return { child_value: 'String' }; } }\nORM.configureModel(Child);\nconst first = Child.find;\nORM.Utils.configureModelType(Child);\nassert.strictEqual(Child.find, first);\nconst parent = new Parent({ parent_value: 'parent' });\nconst child = new Child({ child_value: 'child' });\nparent.save((error) => assert.ifError(error));\nchild.save((error) => assert.ifError(error));\nassert.notStrictEqual(Parent.store, Child.store);\nassert.notStrictEqual(Parent.cache, Child.cache);\nassert.strictEqual(Parent.cache.get(parent.id), parent);\nassert.strictEqual(Child.cache.get(child.id), child);\nlet connectionDisposeCalls = 0;\nconst connection = { id: 'packed-cjs' };\nORM.ConnectionPool.setOwned('packed-cjs', connection, (value, callback) => { assert.strictEqual(value, connection); connectionDisposeCalls += 1; callback(null); });\nconst connectionDisposal = ORM.ConnectionPool.dispose('packed-cjs');\nPromise.all([Parent.find({ parent_value: 'parent' }), Child.find({ child_value: 'child' }), connectionDisposal]).then(([parents, children]) => { assert.strictEqual(parents[0], parent); assert.strictEqual(children[0], child); assert.strictEqual(connectionDisposeCalls, 1); assert.strictEqual(ORM.ConnectionPool.get('packed-cjs'), undefined); console.log('packed cjs consumer passed'); }).catch((error) => { console.error(error); process.exitCode = 1; });\n`
      : `import assert from 'assert';\nimport Backbone from 'backbone';\nimport ORM, { configureModel } from 'backbone-orm';\nimport NodeUMD from 'backbone-orm/umd';\nassert.strictEqual(NodeUMD, ORM);\nassert.strictEqual(ORM.Backbone, Backbone);\nassert.strictEqual(typeof ORM.sync, 'function');\nassert.strictEqual(typeof ORM.Schema, 'function');\nassert.strictEqual(typeof ORM.Utils.configureModelType, 'function');\nORM.configure({ model_cache: { enabled: true, max: 100 } });\nclass Parent extends Backbone.Model { get model_name() { return 'PackedEsmParent'; } schema() { return { parent_value: 'String' }; } }\nconst direct = new ORM.sync.Sync(Parent);\nassert.strictEqual(direct.model_type, Parent);\nconst directSchema = new ORM.Schema(Parent);\ndirectSchema.initialize();\nassert.deepStrictEqual(directSchema.columns(), ['parent_value', 'id']);\nconfigureModel(Parent);\nclass Child extends Parent { get model_name() { return 'PackedEsmChild'; } schema() { return { child_value: 'String' }; } }\nconfigureModel(Child);\nconst first = Child.find;\nORM.Utils.configureModelType(Child);\nassert.strictEqual(Child.find, first);\nconst parent = new Parent({ parent_value: 'parent' });\nconst child = new Child({ child_value: 'child' });\nparent.save((error) => assert.ifError(error));\nchild.save((error) => assert.ifError(error));\nassert.notStrictEqual(Parent.store, Child.store);\nassert.notStrictEqual(Parent.cache, Child.cache);\nassert.strictEqual(Parent.cache.get(parent.id), parent);\nassert.strictEqual(Child.cache.get(child.id), child);\nlet connectionDisposeCalls = 0;\nconst connection = { id: 'packed-esm' };\nORM.ConnectionPool.setOwned('packed-esm', connection, (value, callback) => { assert.strictEqual(value, connection); connectionDisposeCalls += 1; callback(null); });\nawait ORM.ConnectionPool.dispose('packed-esm');\nassert.strictEqual(connectionDisposeCalls, 1);\nassert.strictEqual(ORM.ConnectionPool.get('packed-esm'), undefined);\nconst [parents, children] = await Promise.all([Parent.find({ parent_value: 'parent' }), Child.find({ child_value: 'child' })]);\nassert.strictEqual(parents[0], parent);\nassert.strictEqual(children[0], child);\nconsole.log('packed esm consumer passed');\n`;

  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(path.join(root, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
  writeFileSync(path.join(root, 'src', 'index.ts'), typeSource);
  writeFileSync(path.join(root, 'src', 'raw.ts'), rawTypeSource);
  writeFileSync(path.join(root, `runtime.${format === 'cjs' ? 'cjs' : 'mjs'}`), runtimeSource);
}

mkdirSync(scratchParent, { recursive: true });
const scratchRoot = mkdtempSync(path.join(scratchParent, 'orm-packed-consumers-'));

try {
  const artifactRoot = path.join(scratchRoot, 'artifact');
  mkdirSync(artifactRoot);
  const packOutput = runNode([npmCli, 'pack', '--pack-destination', artifactRoot, '--json'], repoRoot, 'npm pack');
  const packResult = JSON.parse(packOutput) as Record<string, { filename: string }> | Array<{ filename: string }>;
  const packageInfo = Array.isArray(packResult) ? packResult[0] : Object.values(packResult)[0];
  assert.ok(packageInfo, 'npm pack returned no package information');
  const { filename } = packageInfo;
  const tarball = path.join(artifactRoot, filename);
  assert.ok(existsSync(tarball), 'npm pack did not create the reported tarball');

  for (const format of ['cjs', 'esm'] as const) {
    const consumerRoot = path.join(scratchRoot, format);
    mkdirSync(consumerRoot);
    writeConsumer(consumerRoot, format, tarball);
    runNode([npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], consumerRoot, `${format} consumer install`);

    const topLevelPackages = readdirSync(path.join(consumerRoot, 'node_modules')).sort();
    assert.deepStrictEqual(topLevelPackages, ['.package-lock.json', '@types', 'backbone', 'backbone-orm', 'inflection', 'lru-cache', 'pseudomap', 'underscore', 'yallist']);
    assert.ok(!existsSync(path.join(consumerRoot, 'node_modules', 'backbone-orm', 'node_modules', 'backbone')), 'Packed ORM must not contain a nested Backbone');

    runNode([tsds, 'build'], consumerRoot, `${NODE_MODULE_MODES[format]} ${format} typed consumer`);
    runNode([`runtime.${format === 'cjs' ? 'cjs' : 'mjs'}`], consumerRoot, `${format} runtime consumer`);
  }
} finally {
  safeRmSync(scratchRoot);
}
