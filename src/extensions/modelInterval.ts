import type { BackboneORMRuntime } from '../types.ts';
import type { ExtensionCallback, ExtensionModel, ExtensionModelConstructor, ExtensionUnderscore } from './contracts.ts';

const intervalTypes = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

export interface IntervalRange {
  $gt?: Date;
  $gte?: Date;
  $lt?: Date;
  $lte?: Date;
  end?: Date;
  start?: Date;
}

export interface IntervalOptions extends Record<string, unknown> {
  key?: string;
  length?: number;
  range?: IntervalRange;
  type?: string;
}

export interface IterationInfo extends IntervalOptions {
  end?: Date;
  first?: Date;
  index?: number;
  last?: Date;
  range: IntervalRange;
  start?: Date;
}

export default function modelInterval(runtime: BackboneORMRuntime, modelType: ExtensionModelConstructor, query: Record<string, unknown>, iterator: (query: Record<string, unknown>, information: IterationInfo, callback: ExtensionCallback) => unknown, callback: ExtensionCallback): unknown {
  const underscore = runtime._ as ExtensionUnderscore;
  const options = ((query.$interval as IntervalOptions | undefined) ?? {}) as IntervalOptions;
  const key = options.key;
  if (!key) throw new Error('missing option: key');
  if (!options.type) throw new Error('missing option: type');
  if (!intervalTypes.includes(options.type)) throw new Error(`type is not recognized: ${options.type}, false`);
  const iterationInfo = underscore.clone(options) as IterationInfo;
  iterationInfo.range ??= {};
  const range = iterationInfo.range;
  let noModels = false;
  const queue = new runtime.Queue(1);

  queue.defer((next) => {
    const start = range.$gte || range.$gt;
    if (!start) {
      return modelType
        .cursor(query)
        .limit(1)
        .sort(key)
        .toModels((error, value) => {
          if (error) return next(error);
          const models = value as ExtensionModel[];
          if (!models.length) {
            noModels = true;
            return next();
          }
          range.start = iterationInfo.first = models[0].get(key) as Date;
          return next();
        });
    }
    range.start = start;
    return modelType.findOneNearestDate(start, { key, reverse: true }, query, (error, value) => {
      if (error) return next(error);
      const model = value as ExtensionModel | null | undefined;
      if (!model) {
        noModels = true;
        return next();
      }
      iterationInfo.first = model.get(key) as Date;
      return next();
    });
  });

  queue.defer((next) => {
    if (noModels) return next();
    const end = range.$lte || range.$lt;
    if (!end) {
      return modelType
        .cursor(query)
        .limit(1)
        .sort(`-${key}`)
        .toModels((error, value) => {
          if (error) return next(error);
          const models = value as ExtensionModel[];
          if (!models.length) {
            noModels = true;
            return next();
          }
          range.end = iterationInfo.last = models[0].get(key) as Date;
          return next();
        });
    }
    range.end = end;
    return modelType.findOneNearestDate(end, { key }, query, (error, value) => {
      if (error) return next(error);
      const model = value as ExtensionModel | null | undefined;
      if (!model) {
        noModels = true;
        return next();
      }
      iterationInfo.last = model.get(key) as Date;
      return next();
    });
  });

  return queue.await((error) => {
    if (error) return callback(error);
    if (noModels) return callback();
    const startMilliseconds = range.start?.getTime() as number;
    const lengthMilliseconds = runtime.DateUtils.durationAsMilliseconds(underscore.isUndefined(options.length) ? 1 : (options.length as number), options.type as string);
    if (!lengthMilliseconds) throw new Error(`length_ms is invalid: ${String(lengthMilliseconds)} for range: ${String(runtime.JSONUtils.stringify(range))}`);
    const intervalQuery = underscore.omit(query, '$interval') as Record<string, unknown>;
    intervalQuery.$sort = [key];
    iterationInfo.index = 0;

    const runInterval = (current: Date): unknown => {
      if (runtime.DateUtils.isAfter(current, range.end as Date)) return callback();
      intervalQuery[key] = { $gte: current, $lte: iterationInfo.last };
      return modelType.findOne(intervalQuery, (findError, value) => {
        if (findError) return callback(findError);
        const model = value as ExtensionModel | null | undefined;
        if (!model) return callback();
        const nextModelDate = model.get(key) as Date;
        iterationInfo.index = Math.floor((nextModelDate.getTime() - startMilliseconds) / lengthMilliseconds);
        const intervalStart = new Date((range.start as Date).getTime() + iterationInfo.index * lengthMilliseconds);
        iterationInfo.start = intervalStart;
        const intervalEnd = new Date(intervalStart.getTime() + lengthMilliseconds);
        iterationInfo.end = intervalEnd;
        intervalQuery[key] = { $gte: intervalStart, $lt: intervalEnd };
        return iterator(intervalQuery, iterationInfo, (iteratorError) => (iteratorError ? callback(iteratorError) : runInterval(intervalEnd)));
      });
    };
    return runInterval(range.start as Date);
  });
}
