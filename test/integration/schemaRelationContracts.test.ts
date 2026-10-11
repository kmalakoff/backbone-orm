import assert from 'assert';

import { readSchemaRelationContract } from '../lib/readSchemaRelationContract.ts';

describe('legacy and candidate schema/relation contracts', () => {
  let legacy: Record<string, unknown> | undefined;
  let candidate: Record<string, unknown> | undefined;
  const readLegacy = () => (legacy ??= readSchemaRelationContract('runLegacySchemaRelationContract.cjs'));
  const readCandidate = () => (candidate ??= readSchemaRelationContract('runCandidateSchemaRelationContract.cjs'));

  it('pins the retained implementation to independent expectations', () => {
    const legacy = readLegacy();
    assert.deepStrictEqual(legacy.schemaBasics, {
      aliases: {
        allColumns: ['id', 'lazy', 'no_type', 'plain'],
        allRelations: [],
      },
      beforeInitialize: {
        fieldKeys: ['id'],
        lazyCalls: 0,
        rawKeys: ['id', 'lazy', 'no_type', 'plain'],
      },
      columns: ['id', 'lazy', 'no_type', 'plain'],
      fields: {
        id: { indexed: true, manual: true, type: 'Integer' },
        lazy: { indexed: true, type: 'Date' },
        noType: { indexed: true },
        plain: { type: 'String' },
      },
      idType: 'String',
      initializeReturns: [null, null],
      lazyCalls: 1,
      plainOverrideAfterSet: 'Number',
      relationMissing: null,
      reverseMissing: null,
      typeMissing: null,
    });
    assert.deepStrictEqual(legacy.translationBoundaries, {
      directMaps: {
        fieldFallsThrough: true,
        relationFallsThrough: true,
      },
      falsyOverrides: ['String', 'String', 'String'],
      inheritedField: {
        indexed: true,
        manual: true,
        type: 'String',
      },
      inheritedRelation: {
        foreignKey: 'translation_fallback_parent_id',
        manualFetch: true,
        virtual: true,
      },
      joinFallback: true,
      manyCursor: {
        falseQueryAccepted: true,
        falseValuesAccepted: true,
      },
      manyPlainJSONRemoveSome: {
        callbackCount: 0,
        errorName: 'TypeError',
        threw: true,
      },
      manyRemoveAll: {
        callbackCount: 1,
        callbackErrorIsOriginal: true,
        callbackReceiverIsUndefined: true,
        returnedUndefined: true,
      },
      nestedFallback: {
        idTypeUsesDeclaredType: true,
        typeUsesDeclaredType: false,
      },
      onePlainJSONRemoveSome: {
        callbackCount: 0,
        errorName: 'TypeError',
        threw: true,
      },
      oneRemoveAll: {
        callbackCount: 1,
        callbackErrorIsOriginal: true,
        callbackReceiverIsUndefined: true,
        returnedUndefined: true,
      },
      rawFalsy: {
        columns: ['id'],
        raw: {},
      },
      reverseOverride: {
        firstCall: {
          argumentCount: 1,
          key: null,
        },
        usedOverride: true,
      },
    });
    assert.deepStrictEqual(legacy.variants, {
      BelongsTo: 'belongsTo',
      HasMany: 'hasMany',
      HasOne: 'hasOne',
      belongsTo: 'belongsTo',
      belongs_to: 'belongsTo',
      hasMany: 'hasMany',
      hasOne: 'hasOne',
      has_many: 'hasMany',
      has_one: 'hasOne',
    });
    assert.deepStrictEqual(legacy.naming, {
      default: {
        initializedReverseKeys: ['blog_post'],
        relation: {
          embed: false,
          foreignKey: 'blog_post_id',
          joinKey: 'blog_post_id',
          key: 'children',
          manualFetch: false,
          reverseKey: 'blog_post',
          type: 'hasMany',
          virtual: false,
          virtualIdAccessor: 'child_ids',
        },
        reverseKeys: ['blog_post'],
      },
      camelize: {
        initializedReverseKeys: ['blogPost'],
        relation: {
          embed: false,
          foreignKey: 'blog_post_id',
          joinKey: 'blog_post_id',
          key: 'children',
          manualFetch: false,
          reverseKey: 'blogPost',
          type: 'hasMany',
          virtual: false,
          virtualIdAccessor: 'child_ids',
        },
        reverseKeys: ['blogPost'],
      },
      classify: {
        initializedReverseKeys: ['BlogPost'],
        relation: {
          embed: false,
          foreignKey: 'blog_post_id',
          joinKey: 'blog_post_id',
          key: 'children',
          manualFetch: false,
          reverseKey: 'BlogPost',
          type: 'hasMany',
          virtual: false,
          virtualIdAccessor: 'child_ids',
        },
        reverseKeys: ['BlogPost'],
      },
    });
    assert.deepStrictEqual(legacy.cycle, {
      authorColumns: ['name', 'id'],
      authorRelatedModels: ['SchemaCycleBook'],
      belongsToDottedIdType: 'Integer',
      bookColumns: ['title', 'id', 'author_id'],
      bookForeignIdType: 'Integer',
      relation: {
        embed: false,
        foreignKey: 'author_id',
        joinKey: 'schema_cycle_author_id',
        key: 'books',
        manualFetch: false,
        reverseKey: 'author',
        type: 'hasMany',
        virtual: false,
        virtualIdAccessor: 'book_ids',
      },
      reversePointerShared: true,
      reverseRelationLookup: 'books',
      schemaStable: true,
    });
    assert.deepStrictEqual(legacy.generated, {
      generatedReverse: {
        embed: false,
        foreignKey: 'generated_parent_id',
        joinKey: 'generated_child_id',
        key: 'generated_parent',
        manualFetch: true,
        reverseKey: 'children',
        type: 'belongsTo',
        virtual: false,
        virtualIdAccessor: 'generated_parent_id',
      },
      generatedReverseIsReachable: true,
      join: {
        createSyncCalls: [{ owner: 'course' }],
        modelName: 'GeneratedCoursesGeneratedStudents',
        sameConstructor: true,
        schemaKeys: ['generated_course_id', 'generated_student_id'],
        syncIsMemory: true,
        url: '/generated_courses_generated_students',
      },
      joinTableURL: 'generated_courses_generated_students',
    });
    assert.deepStrictEqual(legacy.inheritance, {
      distinctSchemas: [true, true],
      extendedFieldType: 'String',
      extendedInstance: true,
      nativeFieldType: 'String',
      nativeInstance: true,
    });

    const memoryExpected = {
      afterPatchAdd: [
        { id: 1, parent: 1 },
        { id: 2, parent: 1 },
        { id: 3, parent: 1 },
      ],
      afterPatchRemove: [
        { id: 1, parent: null },
        { id: 2, parent: 1 },
        { id: 3, parent: 1 },
      ],
      beforeSave: {
        backlink: true,
        collectionLength: 2,
        ids: [1, 2],
        loaded: true,
      },
      errorCallback: {
        count: 1,
        message: 'Many.patchAdd: model has null id for: books',
        receiverIsUndefined: true,
        returned: 'relation-error-return',
      },
      json: { id: 1, name: 'Ada' },
      loadState: {
        cacheIdentity: true,
        ids: [1, 2],
        loaded: true,
        modelTypes: [true, true],
        sharedCollection: true,
      },
      materialization: {
        includedJSONIsPlain: true,
        includedModelType: false,
        partial: true,
        partialTitle: 'one',
      },
      storedAfterSave: [
        { id: 1, parent: 1 },
        { id: 2, parent: 1 },
        { id: 3, parent: null },
      ],
    };
    assert.deepStrictEqual(legacy.memory, {
      cacheOff: memoryExpected,
      cacheOn: memoryExpected,
    });
    assert.deepStrictEqual(legacy.hasOne, {
      backlinkBeforeSave: true,
      loadedId: 1,
      loadedType: true,
      relation: {
        embed: false,
        foreignKey: 'owner_id',
        joinKey: 'has_one_owner_id',
        key: 'profile',
        manualFetch: false,
        reverseKey: 'owner',
        type: 'hasOne',
        virtual: false,
        virtualIdAccessor: 'profile_id',
      },
      storedAfterAdd: 1,
      storedAfterRemove: null,
      storedAfterSave: 1,
    });
    assert.deepStrictEqual(legacy.manyToMany, {
      backlinks: [false, true],
      joinRowsAfterRemove: [{ course_id: 2, id: 2, student_id: 1 }],
      joinRowsAfterSave: [
        { course_id: 1, id: 1, student_id: 1 },
        { course_id: 2, id: 2, student_id: 1 },
      ],
      relation: {
        embed: false,
        foreignKey: 'student_id',
        joinKey: 'student_id',
        key: 'courses',
        manualFetch: false,
        reverseKey: 'students',
        type: 'hasMany',
        virtual: false,
        virtualIdAccessor: 'course_ids',
      },
      sharedJoin: true,
    });
    assert.deepStrictEqual(legacy.special, {
      embedded: {
        json: {
          id: 1,
          items: [{ embedded_owner_id: 1, id: 11, value: 'inside' }],
          name: 'embedded',
        },
        relation: {
          embed: true,
          foreignKey: 'embedded_owner_id',
          joinKey: 'embedded_owner_id',
          key: 'items',
          manualFetch: false,
          reverseKey: 'embedded_owner',
          type: 'hasMany',
          virtual: false,
          virtualIdAccessor: 'item_ids',
        },
        stored: {
          id: 1,
          items: [{ embedded_owner_id: 1, id: 11, value: 'inside' }],
          name: 'embedded',
        },
      },
      manual: {
        callbackCount: 1,
        callbackValueId: 7,
        loaded: false,
        relation: {
          embed: false,
          foreignKey: 'item_id',
          joinKey: 'manual_owner_id',
          key: 'item',
          manualFetch: true,
          reverseKey: null,
          type: 'belongsTo',
          virtual: false,
          virtualIdAccessor: 'item_id',
        },
        returnIsModel: true,
        synchronousValueId: 7,
      },
      self: {
        backlink: true,
        relation: {
          embed: false,
          foreignKey: 'manager_id',
          joinKey: 'self_person_id',
          key: 'reports',
          manualFetch: false,
          reverseKey: 'manager',
          type: 'hasMany',
          virtual: false,
          virtualIdAccessor: 'report_ids',
        },
        storedManagerId: 2,
      },
      virtual: {
        json: { name: 'virtual owner' },
        relation: {
          embed: false,
          foreignKey: 'item_id',
          joinKey: 'virtual_owner_id',
          key: 'item',
          manualFetch: false,
          reverseKey: null,
          type: 'belongsTo',
          virtual: true,
          virtualIdAccessor: 'item_id',
        },
      },
    });
    assert.deepStrictEqual(legacy.partialCleanup, {
      badCollectionLength: 1,
      badForeignKey: 1,
      cacheHasParent: false,
      callbackCount: 1,
      callbackErrorIsOriginal: true,
      callbackMessage: 'relation-cleanup-write-failed',
      goodCollectionLength: 0,
      goodForeignKey: null,
      parentId: 1,
      parentRows: [],
      receiverIsOptions: true,
      returned: 'partial-cleanup-error-return',
    });
  });

  it('matches the retained oracle except the separately authorized deletion-integrity correction', () => {
    const { partialCleanup: retainedPartial, ...retained } = readLegacy();
    for (const observation of [readCandidate(), readSchemaRelationContract('runCandidateSchemaRelationEsmContract.mjs')]) {
      const { partialCleanup, ...unchanged } = observation;
      assert.deepStrictEqual(unchanged, retained);
      assert.deepStrictEqual(partialCleanup, { ...(retainedPartial as object), cacheHasParent: true, parentRows: [{ name: 'parent', id: 1 }] });
    }
  });

  it('keeps CommonJS and ESM schema ownership coherent in either load order', () => {
    assert.deepStrictEqual(readSchemaRelationContract('runCandidateSchemaRelationCjsFirst.cjs'), {
      relationInstanceShared: true,
      runtimeShared: true,
      schemaConstructorOwnsInstance: true,
      schemaConstructorShared: true,
      schemaIsOwned: true,
      schemaInstanceShared: true,
      syncShared: true,
    });
    assert.deepStrictEqual(readSchemaRelationContract('runCandidateSchemaRelationEsmFirst.mjs'), {
      relationConstructorStable: true,
      runtimeShared: true,
      schemaConstructorOwnsInstance: true,
      schemaConstructorShared: true,
      schemaIsOwned: true,
      schemaInstanceShared: true,
      syncShared: true,
    });
  });
});
