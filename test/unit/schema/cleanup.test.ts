import { spawnSync } from 'node:child_process';
import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';

import { observePublishedSchemaRelationContract } from '../../lib/publicContractObservations.ts';

describe('relation cleanup', () => {
  it('delivers the original error once for a repeated relation completion input', () => {
    const script = `
      const cleanup = require('./src/schema/cleanup.ts').default({ Queue: require('backbone-orm').Queue });
      const failure = new Error('intentional-cleanup-callback-input');
      let count = 0, sameError = false, secondCalls = 0;
      const Type = { schema() { return { relations: {
        first: { patchRemove(model, done) { const result = done(failure); done(); done(new Error('later-input')); return result; } },
        second: { patchRemove(model, done) { secondCalls++; return done(); } }
      } }; } };
      const returned = cleanup(Type, { id: 1 }, (error) => { count++; sameError = error === failure; return 'original-error-return'; });
      process.stdout.write(JSON.stringify({ count, sameError, secondCalls, returned }));
    `;
    const result = spawnSync(process.execPath, ['--require', 'ts-swc-loaders', '--eval', script], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000, killSignal: 'SIGKILL' });
    if (result.error) throw result.error;
    assert.strictEqual(result.status, 0, result.stderr);
    assert.deepStrictEqual(JSON.parse(result.stdout), { count: 1, sameError: true, secondCalls: 0, returned: 'original-error-return' });
  });
  it('retains serial partial writes and the first error while preserving the target row/cache', async () => {
    assert.deepStrictEqual((await observePublishedSchemaRelationContract(ORM, Backbone)).partialCleanup, {
      badCollectionLength: 1,
      badForeignKey: 1,
      cacheHasParent: true,
      callbackCount: 1,
      callbackErrorIsOriginal: true,
      callbackMessage: 'relation-cleanup-write-failed',
      goodCollectionLength: 0,
      goodForeignKey: null,
      parentId: 1,
      parentRows: [{ name: 'parent', id: 1 }],
      receiverIsOptions: true,
      returned: 'partial-cleanup-error-return',
    });
  });
});
