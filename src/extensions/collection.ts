// biome-ignore-all lint/complexity/noArguments: The published fetch overload distinguishes exact argument counts.
import type { BackboneORMRuntime } from '../types.ts';
import type { ExtensionModel, ExtensionModelConstructor } from './contracts.ts';

interface CollectionPrototype extends Backbone.Collection<ExtensionModel> {
  _orm_original_fns?: Record<string, (...arguments_: unknown[]) => unknown>;
  model: ExtensionModelConstructor;
}

export default function installCollectionExtensions(runtime: BackboneORMRuntime): void {
  const collectionType = runtime.Backbone.Collection as unknown as { prototype: CollectionPrototype };
  const prototype = collectionType.prototype;
  if (prototype._orm_original_fns) return;

  const originals: Record<string, (...arguments_: unknown[]) => unknown> = {
    fetch: prototype.fetch as (...arguments_: unknown[]) => unknown,
    _prepareModel: Reflect.get(prototype, '_prepareModel') as (...arguments_: unknown[]) => unknown,
  };
  prototype._orm_original_fns = originals;
  prototype.fetch = function fetch(this: CollectionPrototype, options?: object): unknown {
    const parameters = arguments;
    const callback = parameters[parameters.length - 1];
    let wrappedOptions = options;
    if (typeof callback === 'function') {
      if (parameters.length === 1) wrappedOptions = runtime.Utils.wrapOptions({}, callback);
      else if (parameters.length === 2) wrappedOptions = runtime.Utils.wrapOptions(options, callback);
    }
    return originals.fetch.call(
      this,
      runtime.Utils.wrapOptions(wrappedOptions, (error, model, response, optionsObject) => {
        const finalOptions = optionsObject as Record<string, ((...arguments_: unknown[]) => unknown) | undefined>;
        if (error) return finalOptions.error?.(this, response, finalOptions);
        return finalOptions.success?.(model, response, finalOptions);
      })
    );
  } as Backbone.Collection['fetch'];
  Reflect.set(prototype, '_prepareModel', function prepareModel(this: CollectionPrototype, attributes: unknown, options: object): unknown {
    if (!runtime.Utils.isModel(attributes) && runtime.Utils.dataId(attributes)) {
      const id = runtime.Utils.dataId(attributes);
      const isNew = Boolean(this.model.cache?.get(id));
      const model = runtime.Utils.updateOrNew(attributes, this.model as never) as ExtensionModel;
      if (isNew && !Reflect.apply(Reflect.get(model, '_validate') as (...arguments_: unknown[]) => unknown, model, [attributes, options])) {
        this.trigger('invalid', this, attributes, options);
        return false;
      }
      return model;
    }
    return originals._prepareModel.call(this, attributes, options);
  });
}
