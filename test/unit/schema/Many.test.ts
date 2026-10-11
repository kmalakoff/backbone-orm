import assert from 'assert';
import Backbone from 'backbone';
import ORM from 'backbone-orm';
import { destroy, dispatch, modelType, save } from '../../lib/deletionIntegrityModels.ts';
import { observePublishedRelationOperations, observePublishedSchemaRelationContract } from '../../lib/publicContractObservations.ts';

describe('Many', () => {
  it('preflights every override before an earlier relation can mutate models or rows', () => {
    ORM.configure({ model_cache: { enabled: true, max: 100 } });
    let Parent: ReturnType<typeof modelType>;
    let Child: ReturnType<typeof modelType>;
    const Owner = modelType('OverrideOwner', () => ({ parents: () => ['hasMany', Parent, { as: 'owner' }] }));
    Parent = modelType('OverrideParent', () => ({ id: ['Integer', { manual: true }], owner: () => ['belongsTo', Owner, { as: 'parents' }], children: () => ['hasMany', Child, { as: 'parent' }] }));
    Child = modelType('OverrideChild', () => ({ parent: () => ['belongsTo', Parent, { as: 'children' }] }));
    const owner = new Owner();
    save(owner);
    const parent = new Parent({ id: 1, owner });
    save(parent);
    const child = new Child({ parent });
    save(child);
    const relations = Parent.schema().relations;
    assert.deepStrictEqual(Object.keys(relations), ['owner', 'children']);
    const original = Reflect.get(relations.children, 'patchRemove') as (...arguments_: unknown[]) => unknown;
    let overrideCalls = 0;
    Reflect.set(relations.children, 'patchRemove', function overridden(this: unknown, ...arguments_: unknown[]): unknown {
      overrideCalls++;
      return Reflect.apply(original, this, arguments_);
    });
    const rows = Parent.store.slice();
    const ownerRows = Owner.store.slice();
    const childRows = Child.store.slice();
    let callbackCount = 0;
    dispatch(Parent, 'destroy', {}, (error: Error) => {
      assert.match(error?.message ?? '', /Unsupported relation\.patchRemove override/);
      callbackCount++;
    });
    assert.strictEqual(callbackCount, 1);
    assert.strictEqual(overrideCalls, 0);
    assert.deepStrictEqual(Parent.store, rows);
    assert.deepStrictEqual(Owner.store, ownerRows);
    assert.deepStrictEqual(Child.store, childRows);
    assert.strictEqual(parent.get('owner'), owner);
    assert.strictEqual(child.get('parent'), parent);
    assert.strictEqual(Parent.cache?.get(parent.id), parent);
    ORM.configure({ model_cache: { enabled: false } });
  });

  it('deletes target join rows while retaining reverse rows and unrelated links', () => {
    ORM.configure({ model_cache: { enabled: true, max: 100 } });
    let Course: ReturnType<typeof modelType>;
    const Student = modelType('Student', () => ({ courses: () => ['hasMany', Course, { as: 'students', foreign_key: 'student_id', join_key: 'student_id' }] }));
    Course = modelType('Course', () => ({ students: () => ['hasMany', Student, { as: 'courses', foreign_key: 'course_id', join_key: 'course_id' }] }));
    const first = new Course();
    save(first);
    const second = new Course();
    save(second);
    const student = new Student({ courses: [first, second] });
    save(student);
    const survivor = new Student({ courses: [second] });
    save(survivor);
    const relation = Student.schema().relations.courses;
    assert.ok(relation.join_table);
    assert.strictEqual(relation.join_key, relation.foreign_key);
    assert.strictEqual(relation.join_table.store.length, 3);
    let count = 0;
    destroy(student, (error) => {
      assert.ifError(error);
      count++;
    });
    assert.strictEqual(count, 1);
    assert.strictEqual(Student.store.length, 1);
    assert.strictEqual(Student.store[0].id, survivor.id);
    assert.strictEqual(Course.store.length, 2);
    assert.strictEqual(relation.join_table.store.length, 1);
    assert.strictEqual(relation.join_table.store[0][relation.join_key], survivor.id);
  });
  it('owns loaded and unloaded ID, JSON, model, and array patch inputs', async () => {
    const inputs = (await observePublishedRelationOperations(ORM, Backbone)).manyPatchInputs as Record<string, Record<string, unknown>>;
    assert.deepStrictEqual(Object.keys(inputs).sort(), ['loaded-array', 'loaded-id', 'loaded-json', 'loaded-model', 'unloaded-array', 'unloaded-id', 'unloaded-json', 'unloaded-model']);
    for (const value of Object.values(inputs)) {
      assert.deepStrictEqual(value.removeCallback, {
        argumentCount: 1,
        error: null,
        receiverIsUndefined: true,
        returned: null,
      });
      assert.deepStrictEqual(value.afterRemove, { collectionIds: [], linkedIds: [] });
    }
  });

  it('preserves collection add, remove, reset, and release behavior', async () => {
    const lifecycle = (await observePublishedRelationOperations(ORM, Backbone)).collectionLifecycle as Record<string, unknown>;
    assert.deepStrictEqual(lifecycle, {
      afterAdd: [true, true],
      afterManyRelease: { collectionLength: 1, parentOrmMissing: true },
      afterOneRelease: {
        oldBacklinkRetained: true,
        ormMissing: false,
        profileAfterRelease: 2,
        replacementBacklinkInstalled: false,
      },
      afterRemove: [null, true],
      afterReset: [true, null, [1]],
    });
  });

  it('preserves relation options, cursor fallbacks, and removal contracts', async () => {
    const boundaries = (await observePublishedSchemaRelationContract(ORM, Backbone)).translationBoundaries as Record<string, unknown>;
    assert.deepStrictEqual(boundaries.inheritedRelation, {
      foreignKey: 'translation_fallback_parent_id',
      manualFetch: true,
      virtual: true,
    });
    assert.deepStrictEqual(boundaries.manyCursor, {
      falseQueryAccepted: true,
      falseValuesAccepted: true,
    });
    assert.deepStrictEqual(boundaries.manyRemoveAll, {
      callbackCount: 1,
      callbackErrorIsOriginal: true,
      callbackReceiverIsUndefined: true,
      returnedUndefined: true,
    });
    assert.deepStrictEqual(boundaries.manyPlainJSONRemoveSome, {
      callbackCount: 0,
      errorName: 'TypeError',
      threw: true,
    });
  });
});
