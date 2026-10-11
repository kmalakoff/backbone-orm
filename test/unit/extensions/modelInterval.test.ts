import assert from 'assert';
import Backbone from 'backbone';
import { configureModel } from 'backbone-orm';

describe('modelInterval', () => {
  it('retains public interval ordering and callback completion', async () => {
    class ModelType extends Backbone.Model {
      get model_name() {
        return 'PublicModelInterval';
      }

      schema() {
        return { at: 'Date' };
      }
    }
    Reflect.set(
      ModelType,
      'store',
      [1, 2, 3, 4, 5].map((day, index) => ({ at: new Date(Date.UTC(2020, 0, day)), id: index + 1 }))
    );
    const Configured = configureModel(ModelType) as unknown as typeof ModelType & {
      interval(query: object, iterator: (query: object, information: { start: Date }, next: (error?: Error | null) => unknown) => unknown, callback: (error?: Error | null) => unknown): unknown;
    };
    const starts: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const returned = Configured.interval(
        { $interval: { key: 'at', length: 2, type: 'days' } },
        (_query, information, next) => {
          starts.push(information.start.toISOString());
          return next();
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
      assert.strictEqual(returned, undefined);
    });
    assert.deepStrictEqual(starts, ['2020-01-01T00:00:00.000Z', '2020-01-03T00:00:00.000Z', '2020-01-05T00:00:00.000Z']);
  });
});
