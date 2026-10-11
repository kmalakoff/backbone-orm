import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'assert';
import { safeRmSync } from 'fs-remove-compat';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scratchParent = path.join(repoRoot, '.tmp');
const toolRequire = createRequire(import.meta.url);
const stackEntry = toolRequire.resolve('ts-dev-stack');
const buildPackage = toolRequire.resolve('tsds-build/package.json');
const buildRoot = path.dirname(buildPackage);
const buildEntry = toolRequire.resolve('tsds-build');
const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
for (const name of ['ts-dev-stack', 'tsds-build']) {
  const installed = JSON.parse(readFileSync(toolRequire.resolve(`${name}/package.json`), 'utf8'));
  assert.strictEqual(installed.version, rootPackage.devDependencies[name], `Unexpected type-test tool: ${name}`);
}

function linkDependency(nodeModules: string, name: string): void {
  const source = path.join(repoRoot, 'node_modules', name);
  assert.ok(existsSync(source), `Missing type-test dependency: ${name}`);
  const target = path.join(nodeModules, name);
  mkdirSync(path.dirname(target), { recursive: true });
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}

mkdirSync(scratchParent, { recursive: true });
const fixtureRoot = mkdtempSync(path.join(scratchParent, 'orm-type-consumer-'));

let cleanupSafe = true;

function build(phase: 'positive' | 'sentinel' | 'warning') {
  const receiptPath = path.join(fixtureRoot, `compiler-${phase}.json`);
  assert.ok(!existsSync(receiptPath), `Pre-existing compiler receipt: ${receiptPath}`);
  const childSource = `
    const assert = require('node:assert/strict');
    const { readFileSync, writeFileSync } = require('node:fs');
    const { createRequire } = require('node:module');
    const path = require('node:path');
    const { inspect } = require('node:util');
    const stackEntry = ${JSON.stringify(stackEntry)};
    const buildPackage = ${JSON.stringify(buildPackage)};
    const buildRoot = ${JSON.stringify(buildRoot)};
    const buildEntry = ${JSON.stringify(buildEntry)};
    const receiptPath = ${JSON.stringify(receiptPath)};
    let callbackCount = 0;
    let failed = false;
    let terminalFailed = false;
    let naturalExit = false;
    const callbackErrors = [];
    const diagnostic = (error) => inspect(error, {
      depth: null, maxArrayLength: null, maxStringLength: null,
      showHidden: true, customInspect: false, colors: false
    });
    process.once('beforeExit', () => { naturalExit = true; });
    process.once('uncaughtExceptionMonitor', (error) => {
      terminalFailed = true;
      process.exitCode = 2;
      callbackErrors.push(error);
    });
    process.once('exit', (code) => {
      if (callbackCount !== 1 || !naturalExit || code !== (terminalFailed ? 2 : failed ? 1 : 0)) terminalFailed = true;
      const diagnostics = [];
      for (const error of callbackErrors) {
        try {
          const message = diagnostic(error);
          diagnostics.push(message);
          writeFileSync(2, message + '\\n');
        } catch (outputError) {
          terminalFailed = true;
          diagnostics.push(diagnostic(outputError));
        }
      }
      process.exitCode = terminalFailed ? 2 : failed ? 1 : 0;
      try {
        writeFileSync(receiptPath, JSON.stringify({ callbackCount, failed, terminalFailed, naturalExit, diagnostics }) + '\\n', { flag: 'wx' });
      } catch (receiptError) {
        terminalFailed = true;
        process.exitCode = 2;
        writeFileSync(2, diagnostic(receiptError) + '\\n');
      }
    });
    try {
      const stackRequire = createRequire(stackEntry);
      assert.strictEqual(stackRequire.resolve('ts-dev-stack'), stackEntry);
      for (const [name, version] of Object.entries(${JSON.stringify({ 'ts-dev-stack': rootPackage.devDependencies['ts-dev-stack'], 'tsds-build': rootPackage.devDependencies['tsds-build'] })})) {
        const packagePath = name === 'tsds-build' ? buildPackage : stackRequire.resolve('ts-dev-stack/package.json');
        assert.strictEqual(JSON.parse(readFileSync(packagePath, 'utf8')).version, version);
      }
      const resolveSync = stackRequire('resolve').sync;
      assert.strictEqual(resolveSync(buildPackage, { basedir: path.dirname(stackEntry) }), buildPackage);
      assert.strictEqual(stackRequire.resolve(buildRoot), buildEntry);
      const fixturePackage = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      const config = { ...fixturePackage.tsds, source: fixturePackage.source,
        commands: { build: buildRoot } };
      const { runCommand } = stackRequire('ts-dev-stack');
      runCommand('build', [], { cwd: process.cwd(), config }, (error) => {
        callbackCount += 1;
        if (callbackCount !== 1) {
          terminalFailed = true;
          process.exitCode = 2;
          callbackErrors.push(new Error('Duplicate compiler callback'), error);
          return;
        }
        failed = error !== undefined && error !== null;
        process.exitCode = terminalFailed ? 2 : failed ? 1 : 0;
        if (failed) callbackErrors.push(error);
      });
    } catch (error) {
      terminalFailed = true;
      process.exitCode = 2;
      callbackErrors.push(error);
    }
  `;
  const result = spawnSync(process.execPath, ['--eval', childSource], { cwd: fixtureRoot, encoding: 'utf8' });
  if (result.error || result.signal || result.status === null) {
    cleanupSafe = false;
    throw new AggregateError(result.error ? [result.error] : [], `Compiler closure uncertain; retained ${fixtureRoot}\n${result.stdout}\n${result.stderr}`);
  }
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  assert.ok(existsSync(receiptPath), `Missing compiler callback receipt:\n${result.stdout}\n${result.stderr}`);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert.strictEqual(receipt.callbackCount, 1, 'Compiler must supply exactly one callback');
  assert.strictEqual(typeof receipt.failed, 'boolean');
  assert.strictEqual(typeof receipt.terminalFailed, 'boolean');
  assert.ok(Array.isArray(receipt.diagnostics) && receipt.diagnostics.every((message: unknown) => typeof message === 'string'));
  assert.strictEqual(receipt.terminalFailed, false, `Compiler bootstrap/terminal failure:\n${JSON.stringify(receipt.diagnostics)}\n${result.stdout}\n${result.stderr}`);
  assert.strictEqual(receipt.naturalExit, true, 'Compiler must reach natural terminal completion');
  assert.strictEqual(result.status, receipt.failed ? 1 : 0, `Compiler callback/status mismatch:\n${result.stdout}\n${result.stderr}`);
  return result;
}

let operationFailed = false;
let operationError: unknown;
try {
  const nodeModules = path.join(fixtureRoot, 'node_modules');
  const installedPackage = path.join(nodeModules, 'backbone-orm');
  const sourceDirectory = path.join(fixtureRoot, 'src');
  const ownerDirectory = path.join(sourceDirectory, 'owner');
  const libraryDirectory = path.join(sourceDirectory, 'lib');
  const unitDirectory = path.join(sourceDirectory, 'unit');
  mkdirSync(installedPackage, { recursive: true });
  mkdirSync(sourceDirectory);
  mkdirSync(ownerDirectory);
  mkdirSync(libraryDirectory);
  mkdirSync(path.join(unitDirectory, 'cache'), { recursive: true });
  mkdirSync(path.join(unitDirectory, 'cursor'), { recursive: true });
  mkdirSync(path.join(unitDirectory, 'memory'), { recursive: true });
  mkdirSync(path.join(unitDirectory, 'lib'), { recursive: true });
  mkdirSync(path.join(unitDirectory, 'extensions'), { recursive: true });
  mkdirSync(path.join(unitDirectory, 'schema'), { recursive: true });

  cpSync(path.join(repoRoot, 'package.json'), path.join(installedPackage, 'package.json'));
  cpSync(path.join(repoRoot, 'dist'), path.join(installedPackage, 'dist'), { recursive: true });
  cpSync(path.join(repoRoot, 'test', 'types', 'positive.ts'), path.join(sourceDirectory, 'positive.ts'));
  cpSync(path.join(repoRoot, 'test', 'types', 'expectedErrors.ts'), path.join(sourceDirectory, 'expectedErrors.ts'));
  cpSync(path.join(repoRoot, 'test', 'exports', 'import.test.ts'), path.join(ownerDirectory, 'import.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'memoryFind.test.ts'), path.join(ownerDirectory, 'memoryFind.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'memoryInheritance.test.ts'), path.join(ownerDirectory, 'memoryInheritance.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'memorySync.test.ts'), path.join(ownerDirectory, 'memorySync.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'cursorContracts.test.ts'), path.join(ownerDirectory, 'cursorContracts.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'relationOperations.test.ts'), path.join(ownerDirectory, 'relationOperations.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'schemaRelationContracts.test.ts'), path.join(ownerDirectory, 'schemaRelationContracts.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'integration', 'modelJSONSaveCallbacks.test.ts'), path.join(ownerDirectory, 'modelJSONSaveCallbacks.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'cursorContractScenario.ts'), path.join(libraryDirectory, 'cursorContractScenario.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'cursorDataPropertyAssertions.ts'), path.join(libraryDirectory, 'cursorDataPropertyAssertions.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'publicContractObservations.ts'), path.join(libraryDirectory, 'publicContractObservations.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'readCursorContract.ts'), path.join(libraryDirectory, 'readCursorContract.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'relationOperationsScenario.ts'), path.join(libraryDirectory, 'relationOperationsScenario.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'readRelationOperations.ts'), path.join(libraryDirectory, 'readRelationOperations.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'readSchemaRelationContract.ts'), path.join(libraryDirectory, 'readSchemaRelationContract.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'schemaRelationContractScenario.ts'), path.join(libraryDirectory, 'schemaRelationContractScenario.ts'));
  cpSync(path.join(repoRoot, 'test', 'lib', 'databaseURLAuthorityTests.ts'), path.join(libraryDirectory, 'databaseURLAuthorityTests.ts'));
  for (const helper of ['deletionIntegrityModels.ts', 'queriedDeletionCacheScenario.ts', 'modelDefaultContractScenario.ts', 'modelExtensionContractScenario.ts']) cpSync(path.join(repoRoot, 'test', 'lib', helper), path.join(libraryDirectory, helper));
  cpSync(path.join(repoRoot, 'test', 'unit', 'cache', 'CacheSync.test.ts'), path.join(unitDirectory, 'cache', 'CacheSync.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'unit', 'cursor', 'Cursor.test.ts'), path.join(unitDirectory, 'cursor', 'Cursor.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'unit', 'memory', 'MemoryCursor.test.ts'), path.join(unitDirectory, 'memory', 'MemoryCursor.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'unit', 'memory', 'MemorySync.test.ts'), path.join(unitDirectory, 'memory', 'MemorySync.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'unit', 'extensions', 'model.test.ts'), path.join(unitDirectory, 'extensions', 'model.test.ts'));
  for (const owner of ['One.test.ts', 'Many.test.ts']) cpSync(path.join(repoRoot, 'test', 'unit', 'schema', owner), path.join(unitDirectory, 'schema', owner));
  cpSync(path.join(repoRoot, 'test', 'unit', 'lib', 'DatabaseURL.test.ts'), path.join(unitDirectory, 'lib', 'DatabaseURL.test.ts'));
  cpSync(path.join(repoRoot, 'test', 'unit', 'lib', 'Utils.test.ts'), path.join(unitDirectory, 'lib', 'Utils.test.ts'));
  // Private owner imports use built declarations here; behavior tests load the actual source owner.
  cpSync(path.join(repoRoot, 'dist', 'esm', 'lib', 'Utils.d.ts'), path.join(libraryDirectory, 'Utils.d.ts'));
  cpSync(path.join(repoRoot, 'dist', 'esm', 'types.d.ts'), path.join(sourceDirectory, 'types.d.ts'));

  for (const dependency of ['@types', 'backbone', 'tsds-config', 'underscore']) linkDependency(nodeModules, dependency);

  writeFileSync(path.join(fixtureRoot, 'package.json'), `${JSON.stringify({ name: 'backbone-orm-type-consumer', private: true, type: 'module', source: 'src/positive.ts', tsds: { targets: ['cjs', 'esm'] } }, null, 2)}\n`);
  writeFileSync(path.join(fixtureRoot, 'tsconfig.json'), `${JSON.stringify({ extends: 'tsds-config/tsconfig.json', compilerOptions: { outDir: 'dist', types: ['mocha', 'node'] }, include: ['src'], exclude: ['node_modules', 'dist'] }, null, 2)}\n`);

  const positive = build('positive');
  assert.strictEqual(positive.status, 0, `Type consumer failed:\n${positive.stdout}\n${positive.stderr}`);
  for (const target of ['cjs', 'esm']) {
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'memoryFind.test.js')), `Missing ${target} owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'memoryInheritance.test.js')), `Missing ${target} inheritance owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'memorySync.test.js')), `Missing ${target} memory sync owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'cursorContracts.test.js')), `Missing ${target} cursor contract owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'relationOperations.test.js')), `Missing ${target} relation operation owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'schemaRelationContracts.test.js')), `Missing ${target} schema/relation contract owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'lib', 'cursorContractScenario.js')), `Missing ${target} cursor scenario helper output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'cache', 'CacheSync.test.js')), `Missing ${target} cache cursor owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'cursor', 'Cursor.test.js')), `Missing ${target} base cursor owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'memory', 'MemoryCursor.test.js')), `Missing ${target} memory cursor owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'memory', 'MemorySync.test.js')), `Missing ${target} deletion owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'extensions', 'model.test.js')), `Missing ${target} model deletion boundary output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'lib', 'DatabaseURL.test.js')), `Missing ${target} DatabaseURL owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'unit', 'lib', 'Utils.test.js')), `Missing ${target} Utils owner test output`);
    assert.ok(existsSync(path.join(fixtureRoot, 'dist', target, 'owner', 'modelJSONSaveCallbacks.test.js')), `Missing ${target} private callback contract output`);
  }

  const ownerPath = path.join(ownerDirectory, 'memoryFind.test.ts');
  const originalOwner = readFileSync(ownerPath, 'utf8');
  writeFileSync(ownerPath, `${originalOwner}\nconst ordinaryOwnerSentinel: string = 42;\nvoid ordinaryOwnerSentinel;\n`);
  const sentinel = build('sentinel');
  const sentinelOutput = `${sentinel.stdout}\n${sentinel.stderr}`;
  assert.strictEqual(sentinel.status, 1, 'The ordinary type-test sentinel must fail compilation');
  assert.match(sentinelOutput, /TS2322/);
  writeFileSync(ownerPath, originalOwner);
  writeFileSync(path.join(sourceDirectory, 'ExperimentalWarning.ts'), 'const warningOwnerSentinel: string = 42;\nvoid warningOwnerSentinel;\n');
  const warning = build('warning');
  const warningOutput = `${warning.stdout}\n${warning.stderr}`;
  assert.strictEqual(warning.status, 1, 'A warning-containing compiler diagnostic must remain a failure');
  assert.match(warningOutput, /TS2322/);
  assert.match(warningOutput, /ExperimentalWarning/);
  console.log('CJS/ESM owner and fixture types passed; both real negatives produced TS2322.');
} catch (error) {
  operationFailed = true;
  operationError = error;
}
const cleanupErrors: unknown[] = [];
if (cleanupSafe) {
  try {
    safeRmSync(fixtureRoot);
  } catch (error) {
    cleanupErrors.push(error);
  }
} else {
  cleanupErrors.push(new Error(`Compiler closure uncertain; scratch retained at ${fixtureRoot}`));
}
if (operationFailed && cleanupErrors.length) throw new AggregateError([operationError, ...cleanupErrors], 'Type consumer and cleanup failed');
if (operationFailed) throw operationError;
if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Type consumer cleanup failed');
