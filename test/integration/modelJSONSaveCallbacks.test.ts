import { spawnSync } from 'node:child_process';
import assert from 'assert';
import type { createModelJSONSaveOptions } from '../../src/lib/Utils.ts';

// Native CJS source loading needs the require hook, not the ESM test process's loader.
function runRawCallbackContract(contract: (assertions: typeof assert, rawJSONSaveOptions: typeof createModelJSONSaveOptions) => void): void {
  const script = `(${contract.toString()})(require('assert'), require('./src/lib/Utils.ts').createModelJSONSaveOptions);`;
  const result = spawnSync(process.execPath, ['--require', 'ts-swc-loaders', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
  });
  if (result.error) throw result.error;
  assert.strictEqual(result.signal, null, result.stderr);
  assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

describe('modelJSONSave private raw callback bridge and native source loading', () => {
  it('preserves raw error/response identity, returns and first completion', () => {
    runRawCallbackContract((assertions: typeof assert, rawJSONSaveOptions: typeof createModelJSONSaveOptions) => {
      const response = { id: 1 };
      const failure = new Error('raw sync failure');
      for (const errorFirst of [false, true]) {
        const marker = {};
        const calls: unknown[][] = [];
        const options = rawJSONSaveOptions((...values: unknown[]) => {
          calls.push(values);
          return marker;
        });
        assertions.strictEqual(errorFirst ? options.error(failure) : options.success(response), marker);
        assertions.strictEqual(options.success(response), undefined);
        assertions.strictEqual(options.error(failure), undefined);
        assertions.deepStrictEqual(calls, errorFirst ? [[failure]] : [[null, response, undefined, undefined]]);
        assertions.strictEqual(calls[0][errorFirst ? 0 : 1], errorFirst ? failure : response);
      }
    });
  });

  it('does not catch or renotify a throw from either raw completion', () => {
    runRawCallbackContract((assertions: typeof assert, rawJSONSaveOptions: typeof createModelJSONSaveOptions) => {
      for (const errorFirst of [false, true]) {
        const rawFailure = new Error('raw operation failure');
        const customerFailure = new Error('raw customer throw');
        let calls = 0;
        const options = rawJSONSaveOptions(() => {
          calls++;
          throw customerFailure;
        });
        assertions.throws(
          () => (errorFirst ? options.error(rawFailure) : options.success({ id: 1 })),
          (error: unknown) => error === customerFailure
        );
        assertions.strictEqual(options.success({ id: 2 }), undefined);
        assertions.strictEqual(options.error(rawFailure), undefined);
        assertions.strictEqual(calls, 1);
      }
    });
  });
});
