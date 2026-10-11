import type { BackboneORMRuntime } from '../types.ts';
import type { ExtensionCallback, ExtensionModel, ExtensionModelConstructor } from './contracts.ts';

interface ReadableInstance {
  emit(name: string, value: unknown): unknown;
  push(value: unknown): unknown;
}

interface ReadableConstructor {
  new (options: { objectMode: boolean }): ReadableInstance;
}

interface ModelStreamInstance extends ReadableInstance {
  ended?: boolean;
  model_type: ExtensionModelConstructor;
  query: Record<string, unknown>;
  started?: boolean;
}

export default function createModelStream(runtime: BackboneORMRuntime): (new (modelType: ExtensionModelConstructor, query?: Record<string, unknown>) => ModelStreamInstance) | object {
  const streamModule = (runtime.modules as Record<string, unknown>).stream;
  const Readable = streamModule && (typeof streamModule === 'object' || typeof streamModule === 'function') ? (Reflect.get(streamModule, 'Readable') as ReadableConstructor | undefined) : undefined;
  if (typeof Readable !== 'function') return {};
  return class ModelStream extends Readable implements ModelStreamInstance {
    ended?: boolean;
    model_type: ExtensionModelConstructor;
    query: Record<string, unknown>;
    started?: boolean;

    constructor(modelType: ExtensionModelConstructor, query: Record<string, unknown> = {}) {
      super({ objectMode: true });
      this.model_type = modelType;
      this.query = query;
    }

    _read(): void {
      if (this.ended || this.started) return;
      this.started = true;
      const done: ExtensionCallback = (error) => {
        this.ended = true;
        if (error) this.emit('error', error);
        this.push(null);
      };
      this.model_type.each(
        this.query,
        (model: ExtensionModel, callback: ExtensionCallback) => {
          this.push(model);
          return callback();
        },
        done
      );
    }
  };
}
