import type { BackboneORMRuntime } from '../types.ts';
import type { ExtensionCallback, ExtensionCursor, ExtensionModel, ExtensionModelConstructor, ExtensionUnderscore } from './contracts.ts';

export interface EachOptions {
  fetch?: number;
  json?: boolean;
  threads?: number;
}

export default function modelEach(runtime: BackboneORMRuntime, modelType: ExtensionModelConstructor, query: Record<string, unknown>, iterator: (value: ExtensionModel | Record<string, unknown>, callback: ExtensionCallback) => unknown, callback: ExtensionCallback<number>): unknown {
  const underscore = runtime._ as ExtensionUnderscore;
  const options = (query.$each as EachOptions | undefined) ?? {};
  const method = options.json ? 'toJSON' : 'toModels';
  let processedCount = 0;
  const parsedQuery = runtime.Cursor.parseQuery(underscore.omit(query, '$each'), modelType as never);
  underscore.defaults(parsedQuery.cursor, { $offset: 0, $sort: 'id' });
  const modelLimit = (parsedQuery.cursor.$limit as number | undefined) || Number.POSITIVE_INFINITY;
  if (options.fetch) parsedQuery.cursor.$limit = options.fetch;

  const runBatch = (): unknown => {
    const cursor = modelType.cursor(parsedQuery) as ExtensionCursor;
    const load = Reflect.get(cursor, method) as (done: ExtensionCallback<Array<ExtensionModel | Record<string, unknown>>>) => unknown;
    return Reflect.apply(load, cursor, [
      (error: Error | null, models?: Array<ExtensionModel | Record<string, unknown>>) => {
        if (error || !models) return callback(new Error(`Failed to get models. Error: ${String(error)}`));
        if (!models.length) return callback(null, processedCount);
        const queue = new runtime.Queue(options.threads);
        for (const model of models) {
          processedCount += 1;
          if (processedCount > modelLimit) break;
          queue.defer((next) => iterator(model, next));
        }
        return queue.await((queueError) => {
          if (queueError) return callback(queueError);
          const fetchLimit = parsedQuery.cursor.$limit as number | undefined;
          if (processedCount >= modelLimit || models.length < (fetchLimit as number) || !fetchLimit) return callback(null, processedCount);
          parsedQuery.cursor.$offset = ((parsedQuery.cursor.$offset as number) || 0) + fetchLimit;
          return runBatch();
        });
      },
    ]);
  };
  return runBatch();
}
