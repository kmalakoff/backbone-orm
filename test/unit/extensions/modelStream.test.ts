import assert from 'assert';
import Backbone from 'backbone';
import { configureModel } from 'backbone-orm';

describe('modelStream', () => {
  it('streams real package models in object mode and terminates once', async () => {
    class ModelType extends Backbone.Model {
      get model_name() {
        return 'PublicModelStream';
      }

      schema() {
        return { name: 'String' };
      }
    }
    Reflect.set(ModelType, 'store', [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' },
      { id: 3, name: 'third' },
    ]);
    const Configured = configureModel(ModelType) as unknown as typeof ModelType & {
      stream(query?: object): NodeJS.ReadableStream;
    };
    const names = await new Promise<string[]>((resolve, reject) => {
      const values: string[] = [];
      const stream = Configured.stream({ $each: { fetch: 2 } });
      stream.on('data', (model: Backbone.Model) => values.push(model.get('name') as string));
      stream.on('error', reject);
      stream.on('end', () => resolve(values));
    });
    assert.deepStrictEqual(names, ['first', 'second', 'third']);
  });
});
