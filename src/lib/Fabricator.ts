import type Backbone from 'backbone';

import type { FabricatorConstructor, ModelConstructor, QueueConstructor } from '../types.ts';

interface FabricatorUnderscore {
  isFunction(value: unknown): boolean;
  uniqueId(prefix?: string): string;
}

export default function createFabricator(Queue: QueueConstructor, underscore: FabricatorUnderscore): FabricatorConstructor {
  class Fabricator {
    static new<C extends ModelConstructor<Backbone.Model>>(modelType: C, count: number, attributesInfo: Record<string, unknown>): Array<InstanceType<C>> {
      const results: Array<InstanceType<C>> = [];
      const ModelType = modelType as unknown as new (attributes: Record<string, unknown>) => InstanceType<C>;
      while (count-- > 0) {
        const attributes: Record<string, unknown> = {};
        for (const key in attributesInfo) {
          const value = attributesInfo[key];
          attributes[key] = underscore.isFunction(value) ? (value as () => unknown)() : value;
        }
        results.push(new ModelType(attributes));
      }
      return results;
    }

    static create<C extends ModelConstructor<Backbone.Model>>(modelType: C, count: number, attributesInfo: Record<string, unknown>, callback: (error: Error | null | undefined, models: Array<InstanceType<C>>) => unknown): unknown {
      const models = Fabricator.new(modelType, count, attributesInfo);
      const queue = new Queue();
      for (const model of models) {
        queue.defer((done) => Reflect.apply(Reflect.get(model, 'save') as (...arguments_: unknown[]) => unknown, model, [done]));
      }
      return queue.await((error) => callback(error, models));
    }

    static value(): undefined;
    static value<T>(value: T): () => T;
    static value<T>(...values: [value?: T]): (() => T) | undefined {
      if (values.length === 0) return;
      const [value] = values;
      return () => value as T;
    }

    static increment(): undefined;
    static increment(value: number): () => number;
    static increment(...values: [value?: number]): (() => number) | undefined {
      if (values.length === 0) return;
      const [value] = values;
      let current = value as number;
      return () => current++;
    }

    static uniqueId(): string;
    static uniqueId(prefix: string): () => string;
    static uniqueId(...prefixes: [prefix?: string]): string | (() => string) {
      if (prefixes.length === 0) return underscore.uniqueId();
      const [prefix] = prefixes;
      return () => underscore.uniqueId(prefix);
    }

    static uniqueString: FabricatorConstructor['uniqueId'];

    static date(): Date;
    static date(stepMilliseconds: number): () => Date;
    static date(start: Date, stepMilliseconds: number): () => Date;
    static date(...values: [start?: Date | number, stepMilliseconds?: number]): Date | (() => Date) {
      let [start, stepMilliseconds] = values;
      const now = new Date();
      if (values.length === 0) return now;
      if (values.length === 1) {
        stepMilliseconds = start as number;
        start = now;
      }
      let currentMilliseconds = (start as Date).getTime();
      return () => {
        const current = new Date(currentMilliseconds);
        currentMilliseconds += stepMilliseconds as number;
        return current;
      };
    }
  }

  // Rest implementations preserve the public methods' declared arity metadata.
  Object.defineProperty(Fabricator.value, 'length', { value: 1 });
  Object.defineProperty(Fabricator.increment, 'length', { value: 1 });
  Object.defineProperty(Fabricator.uniqueId, 'length', { value: 1 });
  Object.defineProperty(Fabricator.date, 'length', { value: 2 });
  Fabricator.uniqueString = Fabricator.uniqueId;
  return Fabricator as unknown as FabricatorConstructor;
}
