type Dynamic = any;
type Callback = (error?: Error | null, value?: Dynamic) => Dynamic;

function dispatch(sync: Dynamic, method: string, ...arguments_: Dynamic[]): Dynamic {
  return Reflect.apply(sync, undefined, [method, ...arguments_]);
}

function callbackResult(register: (callback: Callback) => unknown): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    try {
      register((error, value) => (error ? reject(error) : resolve(value)));
    } catch (error) {
      reject(error);
    }
  });
}

function save(model: Dynamic): Promise<Dynamic> {
  return callbackResult((callback) => model.save(callback));
}

function getRelated(model: Dynamic, key: string): Promise<Dynamic> {
  return callbackResult((callback) => model.get(key, callback));
}

function cursorResult(cursor: Dynamic, method = 'toJSON'): Promise<Dynamic> {
  return callbackResult((callback) => cursor[method](callback));
}

function patch(model: Dynamic, method: 'patchAdd' | 'patchRemove', key: string, related?: Dynamic): Promise<Dynamic> {
  return callbackResult((callback) => {
    if (related === undefined) return model[method](key, callback);
    return model[method](key, related, callback);
  });
}

function configure(ORM: Dynamic, type: Dynamic): Dynamic {
  type.prototype.sync = ORM.sync(type);
  return type;
}

function relationSummary(relation: Dynamic): Record<string, unknown> {
  return {
    embed: Boolean(relation.embed),
    foreignKey: relation.foreign_key,
    joinKey: relation.join_key,
    key: relation.key,
    manualFetch: Boolean(relation.manual_fetch),
    reverseKey: relation.reverse_relation?.key ?? null,
    type: relation.type,
    virtual: Boolean(relation.virtual),
    virtualIdAccessor: relation.virtual_id_accessor,
  };
}

function observeSchemaBasics(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  let lazyCalls = 0;
  const Scalar = Backbone.Model.extend({
    model_name: 'SchemaContractScalar',
    schema() {
      return {
        id: ['Integer', { indexed: true, manual: true }],
        lazy: () => {
          lazyCalls += 1;
          return ['Date', { indexed: true }];
        },
        no_type: { indexed: true },
        plain: 'String',
      };
    },
  });
  const schema = new ORM.Schema(Scalar, { id: { type: 'String' }, plain: { type: 'Boolean' } });
  const beforeInitialize = {
    fieldKeys: Object.keys(schema.fields),
    lazyCalls,
    rawKeys: Object.keys(schema.raw),
  };
  const firstReturn = schema.initialize();
  const secondReturn = schema.initialize();
  schema.type('plain', 'Number');
  return {
    aliases: {
      allColumns: schema.allColumns(),
      allRelations: schema.allRelations().map((type: Dynamic) => type.model_name),
    },
    beforeInitialize,
    columns: schema.columns(),
    fields: {
      id: schema.field('id'),
      lazy: schema.field('lazy'),
      noType: schema.field('no_type'),
      plain: schema.field('plain'),
    },
    idType: schema.idType(),
    initializeReturns: [firstReturn, secondReturn],
    lazyCalls,
    plainOverrideAfterSet: schema.type('plain'),
    relationMissing: schema.relation('missing') ?? null,
    reverseMissing: schema.reverseRelation('missing'),
    typeMissing: schema.type('missing') ?? null,
  };
}

function observeRelationVariants(ORM: Dynamic, Backbone: Dynamic): Record<string, string> {
  const result: Record<string, string> = {};
  const variants: Array<[string, string]> = [
    ['hasOne', 'hasOne'],
    ['has_one', 'hasOne'],
    ['HasOne', 'hasOne'],
    ['belongsTo', 'belongsTo'],
    ['belongs_to', 'belongsTo'],
    ['BelongsTo', 'belongsTo'],
    ['hasMany', 'hasMany'],
    ['has_many', 'hasMany'],
    ['HasMany', 'hasMany'],
  ];
  for (const [variant, normalized] of variants) {
    let Left: Dynamic;
    let Right: Dynamic;
    const suffix = variant.replace('_', 'U');
    if (normalized === 'belongsTo') {
      Left = Backbone.Model.extend({
        model_name: `VariantLeft${suffix}`,
        schema() {
          return { right: () => [variant, Right, { as: 'lefts' }] };
        },
      });
      Right = Backbone.Model.extend({
        model_name: `VariantRight${suffix}`,
        schema() {
          return { lefts: () => ['hasMany', Left, { as: 'right' }] };
        },
      });
      configure(ORM, Left);
      configure(ORM, Right);
      result[variant] = Left.relation('right').type;
    } else {
      Left = Backbone.Model.extend({
        model_name: `VariantLeft${suffix}`,
        schema() {
          return { rights: () => [variant, Right, { as: 'left' }] };
        },
      });
      Right = Backbone.Model.extend({
        model_name: `VariantRight${suffix}`,
        schema() {
          return { left: () => ['belongsTo', Left, { as: 'rights' }] };
        },
      });
      configure(ORM, Left);
      configure(ORM, Right);
      result[variant] = Left.relation('rights').type;
    }
  }
  return result;
}

function observeNaming(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  const generated: Record<string, unknown> = {};
  for (const convention of ['default', 'camelize', 'classify']) {
    ORM.configure({ naming_conventions: convention });
    let Parent: Dynamic;
    let Child: Dynamic;
    Parent = Backbone.Model.extend({
      model_name: 'BlogPost',
      schema() {
        return { children: () => ['hasMany', Child] };
      },
    });
    Child = Backbone.Model.extend({
      model_name: 'PostComment',
      schema() {
        return {};
      },
    });
    configure(ORM, Parent);
    configure(ORM, Child);
    const relation = Parent.relation('children');
    const reverseKeys = Object.keys(Child.schema().relations);
    ORM.configure({ naming_conventions: convention === 'default' ? 'classify' : 'default' });
    generated[convention] = {
      initializedReverseKeys: Object.keys(Child.schema().relations),
      relation: relationSummary(relation),
      reverseKeys,
    };
  }
  ORM.configure({ naming_conventions: 'default' });
  return generated;
}

function observeSchemaCycle(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  let Author: Dynamic;
  let Book: Dynamic;
  Author = Backbone.Model.extend({
    model_name: 'SchemaCycleAuthor',
    schema() {
      return { books: () => ['hasMany', Book, { as: 'author' }], name: 'String' };
    },
  });
  Book = Backbone.Model.extend({
    model_name: 'SchemaCycleBook',
    schema() {
      return { author: () => ['belongsTo', Author, { as: 'books' }], title: 'String' };
    },
  });
  configure(ORM, Author);
  configure(ORM, Book);
  const authorSchema = Author.schema();
  const bookSchema = Book.schema();
  const books = Author.relation('books');
  const author = Book.relation('author');
  return {
    authorColumns: authorSchema.columns(),
    authorRelatedModels: authorSchema.relatedModels().map((type: Dynamic) => type.model_name),
    belongsToDottedIdType: bookSchema.idType('author.books.id'),
    bookColumns: bookSchema.columns(),
    bookForeignIdType: bookSchema.type(author.foreign_key),
    relation: relationSummary(books),
    reversePointerShared: books.reverse_relation === author && author.reverse_relation === books,
    reverseRelationLookup: bookSchema.reverseRelation(books.join_key)?.key ?? null,
    schemaStable: Author.schema() === authorSchema && Book.schema() === bookSchema,
  };
}

function observeGeneratedRelations(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  let Parent: Dynamic;
  let Child: Dynamic;
  Parent = Backbone.Model.extend({
    model_name: 'GeneratedParent',
    schema() {
      return { children: () => ['hasMany', Child] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: 'GeneratedChild',
    schema() {
      return {};
    },
  });
  configure(ORM, Parent);
  configure(ORM, Child);
  const parentRelation = Parent.relation('children');
  const generatedReverse = parentRelation.reverse_relation;

  let Student: Dynamic;
  let Course: Dynamic;
  Student = Backbone.Model.extend({
    model_name: 'GeneratedStudent',
    urlRoot: '/students',
    schema() {
      return { courses: () => ['hasMany', Course, { as: 'students' }] };
    },
  });
  Course = Backbone.Model.extend({
    model_name: 'GeneratedCourse',
    urlRoot: '/courses',
    schema() {
      return { students: () => ['hasMany', Student, { as: 'courses' }] };
    },
  });
  configure(ORM, Student);
  configure(ORM, Course);
  const created: Array<{ owner: string; target: string }> = [];
  const studentCreateSync = Student.createSync;
  const courseCreateSync = Course.createSync;
  Student.createSync = function createRecordedSync(type: Dynamic) {
    created.push({ owner: 'student', target: type.model_name });
    return Reflect.apply(studentCreateSync, this, [type]);
  };
  Course.createSync = function createRecordedSync(type: Dynamic) {
    created.push({ owner: 'course', target: type.model_name });
    return Reflect.apply(courseCreateSync, this, [type]);
  };
  const courses = Student.relation('courses');
  const students = Course.relation('students');
  const join = courses.join_table;
  return {
    generatedReverse: relationSummary(generatedReverse),
    generatedReverseIsReachable: Child.relation(generatedReverse.key) === generatedReverse,
    join: {
      createSyncCalls: created,
      modelName: join.model_name,
      sameConstructor: join === students.join_table,
      schemaKeys: Object.keys(join.schema().fields),
      syncIsMemory: join.prototype.sync('isRemote') === false,
      url: new join().urlRoot,
    },
    joinTableURL: ORM.Schema.joinTableURL(courses),
  };
}

async function observeMemoryRelations(ORM: Dynamic, Backbone: Dynamic, cacheEnabled: boolean): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: cacheEnabled, max: 100 } });
  let Author: Dynamic;
  let Book: Dynamic;
  Author = Backbone.Model.extend({
    model_name: `MemoryRelationAuthor${cacheEnabled}`,
    schema() {
      return { books: () => ['hasMany', Book, { as: 'author' }], name: 'String' };
    },
  });
  Book = Backbone.Model.extend({
    model_name: `MemoryRelationBook${cacheEnabled}`,
    schema() {
      return { author: () => ['belongsTo', Author, { as: 'books' }], title: 'String' };
    },
  });
  configure(ORM, Author);
  configure(ORM, Book);
  const book1 = new Book({ title: 'one' });
  const book2 = new Book({ title: 'two' });
  const book3 = new Book({ title: 'three' });
  await save(book1);
  await save(book2);
  await save(book3);
  const author = new Author({ name: 'Ada' });
  author.set('books', [book1, book2]);
  const collection = author.get('books');
  const beforeSave = {
    backlink: book1.get('author') === author,
    collectionLength: collection.length,
    ids: author.get('book_ids'),
    loaded: author.isLoaded('books'),
  };
  await save(author);
  const foreignKey = Book.relation('author').foreign_key;
  const storedAfterSave = Book.store.map((row: Dynamic) => ({ id: row.id, parent: row[foreignKey] ?? null }));
  const loadedAuthor = (await callbackResult((callback) => Author.findOne(author.id, callback))) as Dynamic;
  const loadedBooks = await getRelated(loadedAuthor, 'books');
  const includedJSON = await cursorResult(Book.cursor({ $include: 'author' }));
  const includedModels = await cursorResult(Book.cursor({ $include: 'author' }), 'toModels');
  const partialBook = (await cursorResult(Book.cursor({ $select: 'title' }), 'toModels'))[0];
  const loadState = {
    cacheIdentity: cacheEnabled ? loadedAuthor === author : loadedAuthor !== author,
    ids: loadedBooks.map((book: Dynamic) => book.id),
    loaded: loadedAuthor.isLoaded('books'),
    modelTypes: loadedBooks.map((book: Dynamic) => book instanceof Book),
    sharedCollection: loadedAuthor.get('books').models === loadedBooks,
  };
  const materialization = {
    includedJSONIsPlain: includedJSON.every((book: Dynamic) => !(book.author instanceof Backbone.Model)),
    includedModelType: includedModels.every((book: Dynamic) => book.get('author') instanceof Author),
    partial: partialBook.isPartial(),
    partialTitle: partialBook.get('title'),
  };
  await patch(loadedAuthor, 'patchAdd', 'books', book3);
  const afterPatchAdd = Book.store.map((row: Dynamic) => ({ id: row.id, parent: row[foreignKey] ?? null }));
  await patch(loadedAuthor, 'patchRemove', 'books', book1);
  const afterPatchRemove = Book.store.map((row: Dynamic) => ({ id: row.id, parent: row[foreignKey] ?? null }));
  const json = loadedAuthor.toJSON();
  const unsaved = new Author();
  let errorCallbackCount = 0;
  let errorCallbackMessage: string | undefined;
  let errorCallbackReceiverIsUndefined = false;
  const errorReturn = unsaved.patchAdd('books', book1, function relationErrorCallback(this: unknown, error: Error) {
    errorCallbackCount += 1;
    errorCallbackMessage = error.message;
    errorCallbackReceiverIsUndefined = this === undefined;
    return 'relation-error-return';
  });
  return {
    afterPatchAdd,
    afterPatchRemove,
    beforeSave,
    errorCallback: {
      count: errorCallbackCount,
      message: errorCallbackMessage,
      receiverIsUndefined: errorCallbackReceiverIsUndefined,
      returned: errorReturn,
    },
    json,
    loadState,
    materialization,
    storedAfterSave,
  };
}

async function observeHasOne(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  let Owner: Dynamic;
  let Profile: Dynamic;
  Owner = Backbone.Model.extend({
    model_name: 'HasOneOwner',
    schema() {
      return { profile: () => ['hasOne', Profile, { as: 'owner' }] };
    },
  });
  Profile = Backbone.Model.extend({
    model_name: 'HasOneProfile',
    schema() {
      return { owner: () => ['belongsTo', Owner, { as: 'profile' }] };
    },
  });
  configure(ORM, Owner);
  configure(ORM, Profile);
  const profile = new Profile({ name: 'profile' });
  await save(profile);
  const owner = new Owner({ name: 'owner' });
  owner.set('profile', profile);
  const backlinkBeforeSave = profile.get('owner') === owner;
  await save(owner);
  const foreignKey = Profile.relation('owner').foreign_key;
  const storedAfterSave = Profile.store[0][foreignKey];
  const loaded = await callbackResult((callback) => Owner.findOne(owner.id, callback));
  const loadedProfile = await getRelated(loaded, 'profile');
  await patch(loaded, 'patchRemove', 'profile', loadedProfile);
  const storedAfterRemove = Profile.store[0][foreignKey] ?? null;
  await patch(loaded, 'patchAdd', 'profile', profile);
  return {
    backlinkBeforeSave,
    loadedId: loadedProfile.id,
    loadedType: loadedProfile instanceof Profile,
    relation: relationSummary(Owner.relation('profile')),
    storedAfterAdd: Profile.store[0][foreignKey],
    storedAfterRemove,
    storedAfterSave,
  };
}

async function observeSpecialRelations(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  let EmbeddedOwner: Dynamic;
  let EmbeddedItem: Dynamic;
  EmbeddedOwner = Backbone.Model.extend({
    model_name: 'EmbeddedOwner',
    schema() {
      return { items: () => ['hasMany', EmbeddedItem, { embed: true }], name: 'String' };
    },
  });
  EmbeddedItem = Backbone.Model.extend({
    model_name: 'EmbeddedItem',
    schema() {
      return { owner: () => ['belongsTo', EmbeddedOwner], value: 'String' };
    },
  });
  configure(ORM, EmbeddedOwner);
  configure(ORM, EmbeddedItem);
  const embeddedOwner = new EmbeddedOwner({ name: 'embedded' });
  embeddedOwner.set('items', [new EmbeddedItem({ id: 11, value: 'inside' })]);
  await save(embeddedOwner);

  let ManualOwner: Dynamic;
  let ManualItem: Dynamic;
  ManualOwner = Backbone.Model.extend({
    model_name: 'ManualOwner',
    schema() {
      return { item: () => ['belongsTo', ManualItem, { manual_fetch: true }], name: 'String' };
    },
  });
  ManualItem = Backbone.Model.extend({ model_name: 'ManualItem', schema() { return { name: 'String' }; } });
  configure(ORM, ManualOwner);
  configure(ORM, ManualItem);
  const manual = new ManualOwner({ item_id: 7, name: 'manual' });
  let manualCallbackCount = 0;
  let manualValue: Dynamic;
  const manualReturn = manual.get('item', (_error: Error | null, value: Dynamic) => {
    manualCallbackCount += 1;
    manualValue = value;
    return 'manual-callback-return';
  });

  let VirtualOwner: Dynamic;
  let VirtualItem: Dynamic;
  VirtualOwner = Backbone.Model.extend({
    model_name: 'VirtualOwner',
    schema() {
      return { item: () => ['belongsTo', VirtualItem, { virtual: true }], name: 'String' };
    },
  });
  VirtualItem = Backbone.Model.extend({ model_name: 'VirtualItem', schema() { return { name: 'String' }; } });
  configure(ORM, VirtualOwner);
  configure(ORM, VirtualItem);
  const virtualItem = new VirtualItem({ id: 8, name: 'virtual item' });
  const virtualOwner = new VirtualOwner({ item: virtualItem, name: 'virtual owner' });

  let Person: Dynamic;
  Person = Backbone.Model.extend({
    model_name: 'SelfPerson',
    schema() {
      return {
        manager: () => ['belongsTo', Person, { as: 'reports' }],
        reports: () => ['hasMany', Person, { as: 'manager' }],
      };
    },
  });
  configure(ORM, Person);
  const manager = new Person({ name: 'manager' });
  const report = new Person({ name: 'report' });
  await save(report);
  manager.set('reports', [report]);
  const selfBacklink = report.get('manager') === manager;
  await save(manager);
  const selfForeignKey = Person.relation('manager').foreign_key;

  return {
    embedded: {
      json: embeddedOwner.toJSON(),
      relation: relationSummary(EmbeddedOwner.relation('items')),
      stored: EmbeddedOwner.store[0],
    },
    manual: {
      callbackCount: manualCallbackCount,
      callbackValueId: manualValue?.id ?? null,
      loaded: manual.isLoaded('item'),
      relation: relationSummary(ManualOwner.relation('item')),
      returnIsModel: manualReturn === manualValue,
      synchronousValueId: manual.get('item')?.id ?? null,
    },
    self: {
      backlink: selfBacklink,
      managerIds: manager.get('person_ids'),
      relation: relationSummary(Person.relation('reports')),
      storedManagerId: Person.store.find((row: Dynamic) => row.id === report.id)?.[selfForeignKey],
    },
    virtual: {
      json: virtualOwner.toJSON(),
      relation: relationSummary(VirtualOwner.relation('item')),
    },
  };
}

async function observeManyToMany(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  let Student: Dynamic;
  let Course: Dynamic;
  Student = Backbone.Model.extend({
    model_name: 'Student',
    urlRoot: '/operation_students',
    schema() {
      return { courses: () => ['hasMany', Course] };
    },
  });
  Course = Backbone.Model.extend({
    model_name: 'Course',
    urlRoot: '/operation_courses',
    schema() {
      return { students: () => ['hasMany', Student] };
    },
  });
  configure(ORM, Student);
  configure(ORM, Course);
  const course1 = new Course({ title: 'one' });
  const course2 = new Course({ title: 'two' });
  await save(course1);
  await save(course2);
  const student = new Student({ name: 'student' });
  student.set('courses', [course1, course2]);
  await save(student);
  const relation = Student.relation('courses');
  const joinRowsAfterSave = relation.join_table.store.map((row: Dynamic) => ({ ...row }));
  await patch(student, 'patchRemove', 'courses', course1);
  return {
    backlinks: [course1.get('students').get(student.id) === student, course2.get('students').get(student.id) === student],
    joinRowsAfterRemove: relation.join_table.store.map((row: Dynamic) => ({ ...row })),
    joinRowsAfterSave,
    relation: relationSummary(relation),
    sharedJoin: relation.join_table === Course.relation('students').join_table,
  };
}

async function observeInheritance(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  const ExtendParent = Backbone.Model.extend({
    model_name: 'RelationExtendParent',
    schema() {
      return { value: 'String' };
    },
  });
  const Extended = ExtendParent.extend({ model_name: 'RelationExtendedChild' });
  configure(ORM, Extended);
  configure(ORM, ExtendParent);
  class NativeParent extends Backbone.Model {
    get model_name(): string {
      return 'RelationNativeParent';
    }

    schema(): object {
      return { value: 'String' };
    }
  }
  class Native extends NativeParent {
    get model_name(): string {
      return 'RelationNativeChild';
    }
  }
  configure(ORM, Native);
  configure(ORM, NativeParent);
  const NativeType = Native as Dynamic;
  const NativeParentType = NativeParent as Dynamic;
  return {
    distinctSchemas: [ExtendParent.schema() !== Extended.schema(), NativeParentType.schema() !== NativeType.schema()],
    extendedFieldType: Extended.schema().field('value').type,
    extendedInstance: new Extended() instanceof ExtendParent,
    nativeFieldType: NativeType.schema().field('value').type,
    nativeInstance: new Native() instanceof NativeParent,
  };
}

async function observePartialCleanup(ORM: Dynamic, Backbone: Dynamic, rawSyncError: boolean): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: true, max: 100 } });
  let Parent: Dynamic;
  let Good: Dynamic;
  let Bad: Dynamic;
  Parent = Backbone.Model.extend({
    model_name: 'PartialCleanupParent',
    schema() {
      return {
        good_children: () => ['hasMany', Good, { as: 'parent' }],
        bad_children: () => ['hasMany', Bad, { as: 'parent' }],
      };
    },
  });
  Good = Backbone.Model.extend({
    model_name: 'PartialCleanupGood',
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'good_children' }] };
    },
  });
  Bad = Backbone.Model.extend({
    model_name: 'PartialCleanupBad',
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'bad_children' }] };
    },
  });
  configure(ORM, Parent);
  configure(ORM, Good);
  configure(ORM, Bad);
  const good = new Good({ name: 'good' });
  const bad = new Bad({ name: 'bad' });
  await save(good);
  await save(bad);
  const parent = new Parent({ name: 'parent' });
  parent.set({ bad_children: [bad], good_children: [good] });
  await save(parent);
  const goodForeignKey = Good.relation('parent').foreign_key;
  const badForeignKey = Bad.relation('parent').foreign_key;
  const cleanupError = new Error('relation-cleanup-write-failed');
  const originalBadSync = Bad.prototype.sync;
  Bad.prototype.sync = function failingBadSync(method: string, model: Dynamic, options: Dynamic) {
    if (method === 'update') return rawSyncError ? options.error(cleanupError) : options.error(undefined, cleanupError);
    return Reflect.apply(originalBadSync, this, [method, model, options]);
  };
  let callbackCount = 0;
  let callbackError: Error | null | undefined;
  let receiverIsOptions = false;
  const options = {
    error(error: Error) {
      callbackCount += 1;
      callbackError = error;
      receiverIsOptions = this === options;
      return 'partial-cleanup-error-return';
    },
    success() {
      throw new Error('partial cleanup unexpectedly succeeded');
    },
  };
  const returned = dispatch(Parent.prototype.sync, 'delete', parent, options);
  return {
    badCollectionLength: parent.get('bad_children').length,
    badForeignKey: Bad.store[0][badForeignKey],
    cacheHasParent: Parent.cache.get(parent.id) === parent,
    callbackCount,
    callbackErrorIsOriginal: callbackError === cleanupError,
    callbackMessage: callbackError?.message,
    goodCollectionLength: parent.get('good_children').length,
    goodForeignKey: Good.store[0][goodForeignKey] ?? null,
    parentId: parent.id,
    parentRows: Parent.store.map((row: Dynamic) => ({ ...row })),
    receiverIsOptions,
    returned,
  };
}

function observePlainJSONRemoveSome(relation: Dynamic, model: Dynamic): Record<string, unknown> {
  let callbackCount = 0;
  let thrown: unknown;
  try {
    relation.patchRemove(model, { id: 2 }, () => {
      callbackCount += 1;
    });
  } catch (error) {
    thrown = error;
  }
  return {
    callbackCount,
    errorName: thrown instanceof Error ? thrown.name : null,
    threw: Boolean(thrown),
  };
}

function observeRemoveAllReturn(relation: Dynamic, model: Dynamic, installCursor: (cursor: Dynamic) => void): Record<string, unknown> {
  const cursorError = new Error('translation-boundary-cursor-error');
  const cursorReceiver = {};
  const cursorReturn = {};
  let callbackCount = 0;
  let callbackErrorIsOriginal = false;
  let callbackReceiverIsUndefined = false;
  installCursor({
    toJSON(callback: Dynamic) {
      callback.call(cursorReceiver, cursorError);
      return cursorReturn;
    },
  });
  const returned = relation.patchRemove(model, function callback(this: unknown, error: unknown) {
    callbackCount += 1;
    callbackErrorIsOriginal = error === cursorError;
    callbackReceiverIsUndefined = this === undefined;
  });
  return {
    callbackCount,
    callbackErrorIsOriginal,
    callbackReceiverIsUndefined,
    returnedUndefined: returned === undefined,
  };
}

function observeTranslationBoundaries(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  const RawFalsy = Backbone.Model.extend({
    model_name: 'TranslationRawFalsy',
    schema() {
      return false;
    },
  });
  const rawFalsy = new ORM.Schema(RawFalsy);
  rawFalsy.initialize();

  const Scalar = Backbone.Model.extend({
    model_name: 'TranslationScalar',
    schema() {
      return { name: 'String' };
    },
  });
  const falsyOverrides = [false, 0, ''].map((value) => {
    const schema = new ORM.Schema(Scalar, { name: { type: value } });
    schema.initialize();
    return schema.type('name') ?? null;
  });
  const inheritedFieldOptions = Object.create({ indexed: true, manual: true });
  inheritedFieldOptions.type = 'String';
  const InheritedField = Backbone.Model.extend({
    model_name: 'TranslationInheritedField',
    schema() {
      return { name: ['String', inheritedFieldOptions] };
    },
  });
  const inheritedField = new ORM.Schema(InheritedField);
  inheritedField.initialize();

  const nestedType = {
    schema() {
      return {
        type() {
          return false;
        },
      };
    },
  };
  const nestedSchema = new ORM.Schema(Scalar, { name: { type: nestedType } });
  nestedSchema.initialize();

  const MapModel = Backbone.Model.extend({ schema() { return {}; } });
  const mapSchema = new ORM.Schema(MapModel);
  mapSchema.initialize();
  const relationMarker = { marker: 'relation' };
  const virtualMarker = { marker: 'virtual' };
  mapSchema.fields.direct = false;
  mapSchema.relations.direct = relationMarker;
  mapSchema.relations.virtual = false;
  mapSchema.virtual_accessors.virtual = virtualMarker;

  let Child: Dynamic;
  const inheritedRelationOptions = Object.create({ manual_fetch: true, virtual: true });
  inheritedRelationOptions.as = '';
  const Parent = Backbone.Model.extend({
    model_name: 'TranslationFallbackParent',
    schema() {
      return { children: () => ['hasMany', Child, inheritedRelationOptions] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: 'TranslationFallbackChild',
    schema() {
      return {};
    },
  });
  configure(ORM, Child);
  configure(ORM, Parent);
  const manyRelation = Parent.relation('children');
  const joinMarker = function TranslationJoinMarker() {};
  manyRelation.join_table = false;
  manyRelation.reverse_relation.join_table = joinMarker;
  const joinFallback = manyRelation.findOrGenerateJoinTable() === joinMarker;

  let falseQueryAccepted = true;
  let falseValuesAccepted = true;
  Child.cursor = () => ({ toJSON() {} });
  try {
    manyRelation.cursor({ id: 7 }, manyRelation.key, false);
  } catch {
    falseQueryAccepted = false;
  }
  try {
    manyRelation.cursor({ id: 7 }, manyRelation.virtual_id_accessor, { $values: false });
  } catch {
    falseValuesAccepted = false;
  }

  let OverrideChild: Dynamic;
  const OverrideParent = Backbone.Model.extend({
    model_name: 'TranslationOverrideParent',
    schema() {
      return { children: () => ['hasMany', OverrideChild] };
    },
  });
  OverrideChild = Backbone.Model.extend({
    model_name: 'TranslationOverrideChild',
    schema() {
      return {};
    },
  });
  configure(ORM, OverrideChild);
  const originalRelation = OverrideChild.relation;
  const overrideCalls: Array<{ argumentCount: number; key: unknown }> = [];
  const overrideRelation: Dynamic = {
    foreign_key: 'translation_override_parent_id',
    join_key: 'translation_override_parent_id',
    key: 'translation_override_parent',
    model_type: OverrideChild,
    reverse_model_type: OverrideParent,
    type: 'belongsTo',
  };
  OverrideChild.relation = function relationOverride(key: unknown) {
    overrideCalls.push({ argumentCount: arguments.length, key: key ?? null });
    if (arguments.length === 1 && key === undefined) return overrideRelation;
    return Reflect.apply(originalRelation, this, [key]);
  };
  configure(ORM, OverrideParent);
  const overrideForward = OverrideParent.relation('children');

  const manyRemoveAll = observeRemoveAllReturn(manyRelation, { children: [], id: 7 }, (cursor) => {
    Child.cursor = () => cursor;
  });
  const manyPlainJSONRemoveSome = observePlainJSONRemoveSome(manyRelation, { children: [], id: 7 });

  let Profile: Dynamic;
  const Owner = Backbone.Model.extend({
    model_name: 'TranslationReturnOwner',
    schema() {
      return { profile: () => ['hasOne', Profile, { as: 'owner' }] };
    },
  });
  Profile = Backbone.Model.extend({
    model_name: 'TranslationReturnProfile',
    schema() {
      return { owner: () => ['belongsTo', Owner, { as: 'profile' }] };
    },
  });
  configure(ORM, Profile);
  configure(ORM, Owner);
  const oneRelation = Owner.relation('profile');
  const oneRemoveAll = observeRemoveAllReturn(oneRelation, { id: 8, profile: null }, (cursor) => {
    oneRelation.cursor = () => cursor;
  });
  const onePlainJSONRemoveSome = observePlainJSONRemoveSome(oneRelation, { id: 8, profile: null });

  return {
    directMaps: {
      fieldFallsThrough: mapSchema.field('direct') === relationMarker,
      relationFallsThrough: mapSchema.relation('virtual') === virtualMarker,
    },
    falsyOverrides,
    inheritedField: inheritedField.field('name'),
    inheritedRelation: {
      foreignKey: manyRelation.foreign_key,
      manualFetch: manyRelation.manual_fetch,
      virtual: manyRelation.virtual,
    },
    joinFallback,
    manyCursor: { falseQueryAccepted, falseValuesAccepted },
    manyPlainJSONRemoveSome,
    manyRemoveAll,
    nestedFallback: {
      idTypeUsesDeclaredType: nestedSchema.idType('name') === nestedType,
      typeUsesDeclaredType: nestedSchema.type('name.id') === nestedType,
    },
    onePlainJSONRemoveSome,
    oneRemoveAll,
    rawFalsy: { columns: rawFalsy.columns(), raw: rawFalsy.raw },
    reverseOverride: {
      firstCall: overrideCalls[0],
      usedOverride: overrideForward.reverse_relation === overrideRelation,
    },
  };
}

export default async function observeSchemaRelationContract(ORM: Dynamic, Backbone: Dynamic, rawSyncError = false): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  const observe = async <T>(name: string, operation: () => T | Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const wrapped = new Error(`Schema/relation observation failed in ${name}`) as Error & { cause?: unknown };
      wrapped.cause = error;
      throw wrapped;
    }
  };
  const schemaBasics = await observe('schema basics', () => observeSchemaBasics(ORM, Backbone));
  const variants = await observe('relation variants', () => observeRelationVariants(ORM, Backbone));
  const naming = await observe('naming conventions', () => observeNaming(ORM, Backbone));
  const cycle = await observe('schema cycle', () => observeSchemaCycle(ORM, Backbone));
  const generated = await observe('generated relations', () => observeGeneratedRelations(ORM, Backbone));
  const cacheOff = await observe('memory relations without cache', () => observeMemoryRelations(ORM, Backbone, false));
  const cacheOn = await observe('memory relations with cache', () => observeMemoryRelations(ORM, Backbone, true));
  const special = await observe('special relations', () => observeSpecialRelations(ORM, Backbone));
  const hasOne = await observe('has-one relation', () => observeHasOne(ORM, Backbone));
  const manyToMany = await observe('many-to-many relations', () => observeManyToMany(ORM, Backbone));
  const inheritance = await observe('inheritance', () => observeInheritance(ORM, Backbone));
  const partialCleanup = await observe('partial cleanup', () => observePartialCleanup(ORM, Backbone, rawSyncError));
  const translationBoundaries = await observe('translation boundaries', () => observeTranslationBoundaries(ORM, Backbone));
  return { cycle, generated, hasOne, inheritance, manyToMany, memory: { cacheOff, cacheOn }, naming, partialCleanup, schemaBasics, special, translationBoundaries, variants };
}
