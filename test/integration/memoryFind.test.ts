import assert from 'assert';
import Backbone from 'backbone';
import BackboneORM, { configureModel, type FindQuery, type ORMModelConstructor } from 'backbone-orm';

interface AuthorAttributes {
  name: string;
}

type Author = Backbone.Model<AuthorAttributes>;

type PersistenceCallback<M> = (this: void, error: Error | null, model: M, response: unknown, options: object) => void;

interface LegacyModelRuntime<M> {
  fetch(callback: PersistenceCallback<M>): unknown;
  get(key: string, callback?: (this: void, error: Error | null, value: unknown) => void): unknown;
  save(callback: PersistenceCallback<M>): unknown;
  save(attributes: object | null, options: object, callback: PersistenceCallback<M>): unknown;
  set(key: string, value: unknown): M;
}

function createAuthorType(suffix: string): ORMModelConstructor<Author> {
  const Author: ORMModelConstructor<Author> = Backbone.Model.extend({
    model_name: `StaticFindAuthor${suffix}`,
    schema() {
      return { name: 'String' };
    },
  });
  Author.prototype.sync = BackboneORM.sync(Author);
  return Author;
}

function save(model: Backbone.Model): void {
  let error: Error | null | undefined;
  const runtimeModel = model as Backbone.Model & LegacyModelRuntime<Backbone.Model>;
  const returned = runtimeModel.save((saveError: Error | null) => {
    error = saveError;
  });
  assert.ifError(error);
  assert.strictEqual(returned, undefined);
}

describe('memory static find', () => {
  beforeEach(() => {
    BackboneORM.configure({ model_cache: { enabled: false } });
  });

  it('uses the consumer Backbone and installs from the ORM sync path', () => {
    assert.strictEqual(BackboneORM.Backbone, Backbone);
    const Author = createAuthorType('Configuration');
    assert.ok(Object.getOwnPropertyDescriptor(Author, 'find'));
    assert.strictEqual(typeof Author.find, 'function');
  });

  it('supports callback and Promise forms with concrete models', async () => {
    const Author = createAuthorType('Forms');
    save(new Author({ name: 'Ada' }));
    save(new Author({ name: 'Grace' }));

    const order: string[] = [];
    let callbackCount = 0;
    let callbackContext: unknown = null;
    const callbackReturn = Author.find({ name: 'Ada' }, function (error, authors) {
      callbackCount += 1;
      callbackContext = this;
      order.push('callback');
      assert.ifError(error);
      assert.strictEqual(authors?.length, 1);
      assert.strictEqual(authors[0].get('name'), 'Ada');
    });
    order.push('return');
    assert.strictEqual(callbackReturn, undefined);
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(callbackContext, undefined);
    assert.deepStrictEqual(order, ['callback', 'return']);

    let allCallbackCount = 0;
    const allCallbackReturn = Author.find((error, authors) => {
      allCallbackCount += 1;
      assert.ifError(error);
      assert.deepStrictEqual(authors?.map((author) => author.get('name')).sort(), ['Ada', 'Grace']);
    });
    assert.strictEqual(allCallbackReturn, undefined);
    assert.strictEqual(allCallbackCount, 1);

    const allPromise = Author.find();
    assert.ok(allPromise instanceof Promise);
    assert.deepStrictEqual((await allPromise).map((author) => author.get('name')).sort(), ['Ada', 'Grace']);

    const queried = await Author.find({ name: 'Grace' });
    assert.strictEqual(queried.length, 1);
    assert.ok(queried[0] instanceof Author);
    assert.strictEqual(queried[0].get('name'), 'Grace');
  });

  it('replaces incompatible static find types and retains configured inheritance', async () => {
    class NativeAuthor extends Backbone.Model<AuthorAttributes> {
      static readonly category = 'native-author';

      get model_name() {
        return 'StaticFindExistingNative';
      }

      schema() {
        return { name: 'String' };
      }

      static find(): string {
        return 'custom';
      }
    }

    const ConfiguredNativeAuthor = configureModel(NativeAuthor);
    const nativeAuthors: Promise<NativeAuthor[]> = ConfiguredNativeAuthor.find();
    assert.ok(nativeAuthors instanceof Promise);
    assert.deepStrictEqual(await nativeAuthors, []);
    assert.strictEqual(ConfiguredNativeAuthor.category, 'native-author');

    class ChildAuthor extends ConfiguredNativeAuthor {
      get model_name() {
        return 'StaticFindExistingNativeChild';
      }
    }

    const ConfiguredChildAuthor = configureModel(ChildAuthor);
    const childAuthors: Promise<ChildAuthor[]> = ConfiguredChildAuthor.find();
    assert.ok(childAuthors instanceof Promise);
    await childAuthors.catch((error) => assert.doesNotMatch(error.message, /callback is not a function/));
  });

  it('preserves callback exceptions and exposes terminal errors in both forms', async () => {
    const Author = createAuthorType('Failures');
    save(new Author({ name: 'Ada' }));

    const callbackError = new Error('find callback error');
    let callbackCount = 0;
    assert.throws(
      () =>
        Author.find(() => {
          callbackCount += 1;
          throw callbackError;
        }),
      (error) => error === callbackError
    );
    assert.strictEqual(callbackCount, 1);

    const invalidQuery: FindQuery<AuthorAttributes> = {};
    Reflect.set(invalidQuery, '$values', ['name']);
    let errorCount = 0;
    let errorContext: unknown = null;
    const callbackReturn = Author.find(invalidQuery, function (error, authors) {
      errorCount += 1;
      errorContext = this;
      assert.match(error?.message ?? '', /Cannot call toModels on cursor with values/);
      assert.strictEqual(authors, undefined);
    });
    assert.strictEqual(callbackReturn, undefined);
    assert.strictEqual(errorCount, 1);
    assert.strictEqual(errorContext, undefined);
    await assert.rejects(Author.find(invalidQuery), /Cannot call toModels on cursor with values/);
  });

  it('leaves memory persistence, relations, and cache identity behavior intact', () => {
    BackboneORM.configure({ model_cache: { enabled: true, max: 100 } });
    let Author: ORMModelConstructor<Author>;
    let Book: ORMModelConstructor<Backbone.Model<{ title: string; author_id?: number }>>;

    Author = Backbone.Model.extend({
      model_name: 'StaticFindRelationAuthor',
      schema() {
        return { books: ['hasMany', Book] };
      },
    });
    Book = Backbone.Model.extend({
      model_name: 'StaticFindRelationBook',
      schema() {
        return { author: ['belongsTo', Author] };
      },
    });
    Author.prototype.sync = BackboneORM.sync(Author);
    Book.prototype.sync = BackboneORM.sync(Book);

    const book = new Book({ title: 'Notes' });
    save(book);
    const author = new Author({ name: 'Ada' });
    const runtimeAuthor = author as Author & LegacyModelRuntime<Author>;
    runtimeAuthor.set('books', [book]);

    const order: string[] = [];
    let callbackCount = 0;
    author.on('sync', () => order.push('sync'));
    const options = { contractMarker: 'save-options' };
    const returned = runtimeAuthor.save(null, options, (error, saved, response, returnedOptions) => {
      callbackCount += 1;
      order.push('callback');
      assert.ifError(error);
      assert.strictEqual(saved, author);
      assert.deepStrictEqual(response, { name: 'Ada', id: author.id });
      assert.strictEqual(returnedOptions, options);
    });
    order.push('return');
    assert.strictEqual(returned, undefined);
    assert.strictEqual(callbackCount, 1);
    assert.deepStrictEqual(order, ['callback', 'sync', 'return']);

    let found: Author[] | undefined;
    Author.find({ name: 'Ada' }, (error, authors) => {
      assert.ifError(error);
      found = authors;
    });
    assert.strictEqual(found?.length, 1);
    assert.strictEqual(found[0], author);

    const fetchedBook = new Book({ id: book.id });
    const runtimeBook = fetchedBook as typeof fetchedBook & LegacyModelRuntime<typeof fetchedBook>;
    let fetchError: Error | null | undefined;
    runtimeBook.fetch((error: Error | null) => {
      fetchError = error;
    });
    assert.ifError(fetchError);
    const synchronousAuthor = runtimeBook.get('author') as Author;
    let relationCount = 0;
    const relationReturn = runtimeBook.get('author', (error, related) => {
      relationCount += 1;
      assert.ifError(error);
      assert.strictEqual(related, synchronousAuthor);
    });
    assert.strictEqual(relationReturn, synchronousAuthor);
    assert.strictEqual(relationCount, 1);
  });
});
