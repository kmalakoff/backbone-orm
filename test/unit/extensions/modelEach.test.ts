import assert from 'assert';
import Backbone from 'backbone';
import { configureModel } from 'backbone-orm';

describe('modelEach', () => {
  it('keeps public batching ordered and completes a larger package-name workload', async () => {
    class ModelType extends Backbone.Model {
      get model_name() {
        return 'PublicModelEach';
      }

      schema() {
        return { value: 'Integer' };
      }
    }
    Reflect.set(
      ModelType,
      'store',
      Array.from({ length: 3001 }, (_value, index) => ({ id: index + 1, value: index + 1 }))
    );
    const Configured = configureModel(ModelType) as unknown as typeof ModelType & {
      each(query: object, iterator: (json: Record<string, unknown>, next: (error?: Error | null) => unknown) => unknown, callback: (error?: Error | null, count?: number) => unknown): unknown;
    };
    const values: number[] = [];
    const count = await new Promise<number>((resolve, reject) => {
      const returned = Configured.each(
        { $each: { fetch: 17, json: true } },
        (json, next) => {
          values.push(json.value as number);
          return next();
        },
        (error, processed) => {
          if (error) reject(error);
          else resolve(processed as number);
        }
      );
      assert.strictEqual(returned, undefined);
    });
    assert.strictEqual(count, 3001);
    assert.strictEqual(values.length, 3001);
    const expected = Array.from({ length: 3001 }, (_value, index) => index + 1).sort((left, right) => (String(left) > String(right) ? 1 : -1));
    assert.deepStrictEqual(values, expected);
  });
});
