import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'assert';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default function readFabricatorTestUtilsContract(entry: string, ...arguments_: string[]): Record<string, unknown> {
  const result = spawnSync(process.execPath, ['--require', 'ts-swc-loaders', path.join(repoRoot, 'test', 'lib', entry), ...arguments_], {
    cwd: repoRoot,
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  assert.strictEqual(result.signal, null, `${entry} terminated by ${result.signal}:\n${result.stdout}\n${result.stderr}`);
  assert.strictEqual(result.status, 0, `${entry} failed:\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}
