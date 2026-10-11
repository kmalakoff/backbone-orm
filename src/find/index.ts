import type Backbone from 'backbone';

import type { FindMethod, FindQuery, ModelAttributes, ModelConstructor, ResultCallback } from '../types.ts';
import findWorker from './worker.ts';

const installedFindKey = Symbol.for('backbone-orm.static-find');

interface InstalledFindState<C extends ModelConstructor<Backbone.Model>> {
  find: FindMethod<InstanceType<C>>;
}

function installedFindState<C extends ModelConstructor<Backbone.Model>>(modelType: C): InstalledFindState<C> | undefined {
  if (!Object.getOwnPropertyDescriptor(modelType, installedFindKey)) return;
  const host: object = modelType;
  return Reflect.get(host, installedFindKey);
}

export default function installFind<C extends ModelConstructor<Backbone.Model>>(modelType: C): FindMethod<InstanceType<C>> {
  type M = InstanceType<C>;
  const installed = installedFindState(modelType);
  if (installed) {
    Reflect.set(modelType, 'find', installed.find);
    return installed.find;
  }

  function find(callback: ResultCallback<M[]>): void;
  function find(query: FindQuery<ModelAttributes<M>>, callback: ResultCallback<M[]>): void;
  function find(): Promise<M[]>;
  function find(query: FindQuery<ModelAttributes<M>>): Promise<M[]>;
  function find(queryOrCallback?: FindQuery<ModelAttributes<M>> | ResultCallback<M[]>, callback?: ResultCallback<M[]>): void | Promise<M[]> {
    if (typeof queryOrCallback === 'function') {
      findWorker(modelType, {}, queryOrCallback);
      return;
    }
    const query = queryOrCallback ?? {};
    if (callback) {
      findWorker(modelType, query, callback);
      return;
    }
    return new Promise<M[]>((resolve, reject) => {
      findWorker(modelType, query, (error, models) => {
        if (error) {
          reject(error);
          return;
        }
        if (!models) {
          reject(new Error('Backbone ORM find succeeded without models'));
          return;
        }
        resolve(models);
      });
    });
  }

  Reflect.set(modelType, 'find', find);
  Object.defineProperty(modelType, installedFindKey, { value: { find } satisfies InstalledFindState<C> });
  return find;
}
