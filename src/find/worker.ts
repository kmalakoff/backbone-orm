import type Backbone from 'backbone';

import type { FindQuery, ModelAttributes, ModelConstructor, ResultCallback } from '../types.ts';

interface RuntimeCursor<M extends Backbone.Model> {
  toModels(callback: ResultCallback<M[]>): unknown;
}

type RuntimeSync<M extends Backbone.Model> = (this: M, method: 'cursor', query: object) => RuntimeCursor<M>;

export default function findWorker<C extends ModelConstructor<Backbone.Model>>(modelType: C, query: FindQuery<ModelAttributes<InstanceType<C>>>, callback: ResultCallback<InstanceType<C>[]>): void {
  type M = InstanceType<C>;
  const runtimePrototype: object = modelType.prototype;
  const sync: RuntimeSync<M> = Reflect.get(runtimePrototype, 'sync');
  const cursor: RuntimeCursor<M> = Reflect.apply(sync, runtimePrototype, ['cursor', query]);
  cursor.toModels(callback);
}
