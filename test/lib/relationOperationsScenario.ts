type Dynamic = any;
type Callback = (error?: Error | null, value?: Dynamic) => Dynamic;

function configure(ORM: Dynamic, type: Dynamic): Dynamic {
  type.prototype.sync = ORM.sync(type);
  return type;
}

function callbackResult(register: (callback: Callback) => unknown): Promise<Dynamic> {
  return new Promise((resolve, reject) => {
    register((error, value) => (error ? reject(error) : resolve(value)));
  });
}

function save(model: Dynamic): Promise<Dynamic> {
  return callbackResult((callback) => model.save(callback));
}

function findOne(type: Dynamic, id: unknown): Promise<Dynamic> {
  return callbackResult((callback) => type.findOne(id, callback));
}

function getRelated(model: Dynamic, key: string): Promise<Dynamic> {
  return callbackResult((callback) => model.get(key, callback));
}

async function observeCallback(invoke: (callback: Callback) => unknown): Promise<Record<string, unknown>> {
  let callbackArguments: Dynamic[] = [];
  let receiverIsUndefined = false;
  let returned: unknown;
  await new Promise<void>((resolve) => {
    returned = invoke(function observedCallback(this: unknown, ...values: Dynamic[]) {
      callbackArguments = values;
      receiverIsUndefined = this === undefined;
      resolve();
      return 'operation-callback-return';
    });
  });
  return {
    argumentCount: callbackArguments.length,
    error: callbackArguments[0]?.message ?? null,
    receiverIsUndefined,
    returned: returned ?? null,
  };
}

function patch(model: Dynamic, method: 'patchAdd' | 'patchRemove', key: string, related?: unknown): Promise<Record<string, unknown>> {
  return observeCallback((callback) => (related === undefined ? model[method](key, callback) : model[method](key, related, callback)));
}

async function observeManyPatchInputs(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  let Parent: Dynamic;
  let Child: Dynamic;
  Parent = Backbone.Model.extend({
    model_name: 'OperationManyParent',
    schema() {
      return { children: () => ['hasMany', Child, { as: 'parent' }] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: 'OperationManyChild',
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
    },
  });
  configure(ORM, Parent);
  configure(ORM, Child);
  const foreignKey = Child.relation('parent').foreign_key;
  const observations: Record<string, unknown> = {};

  for (const loaded of [false, true]) {
    for (const kind of ['id', 'json', 'model', 'array']) {
      const children = [new Child({ title: `${kind}-one` }), new Child({ title: `${kind}-two` }), new Child({ title: `${kind}-three` })];
      for (const child of children) await save(child);
      const parent = new Parent({ name: `${kind}-${loaded}` });
      await save(parent);
      const target = await findOne(Parent, parent.id);
      if (loaded) await getRelated(target, 'children');
      const input =
        kind === 'id'
          ? children[0].id
          : kind === 'json'
            ? { id: children[0].id, title: 'json-updated' }
            : kind === 'model'
              ? children[0]
              : [children[0].id, { id: children[1].id, title: 'array-json' }, children[2]];
      const addCallback = await patch(target, 'patchAdd', 'children', input);
      const collection = target.get('children');
      const afterAdd = {
        collectionIds: collection.models.map((model: Dynamic) => model.id),
        linkedIds: Child.store.filter((row: Dynamic) => row[foreignKey] === parent.id).map((row: Dynamic) => row.id),
        loaded: target.isLoaded('children'),
      };
      const removeCallback = await patch(target, 'patchRemove', 'children', input);
      observations[`${loaded ? 'loaded' : 'unloaded'}-${kind}`] = {
        addCallback,
        afterAdd,
        afterRemove: {
          collectionIds: collection.models.map((model: Dynamic) => model.id),
          linkedIds: Child.store.filter((row: Dynamic) => row[foreignKey] === parent.id).map((row: Dynamic) => row.id),
        },
        removeCallback,
      };
    }
  }
  return observations;
}

async function observeOnePatchInputs(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  let Owner: Dynamic;
  let Profile: Dynamic;
  Owner = Backbone.Model.extend({
    model_name: 'OperationOneOwner',
    schema() {
      return { profile: () => ['hasOne', Profile, { as: 'owner' }] };
    },
  });
  Profile = Backbone.Model.extend({
    model_name: 'OperationOneProfile',
    schema() {
      return { owner: () => ['belongsTo', Owner, { as: 'profile' }] };
    },
  });
  configure(ORM, Owner);
  configure(ORM, Profile);
  const foreignKey = Profile.relation('owner').foreign_key;
  const observations: Record<string, unknown> = {};

  for (const loaded of [false, true]) {
    for (const kind of ['id', 'json', 'model']) {
      const profile = new Profile({ label: `${kind}-${loaded}` });
      await save(profile);
      const owner = new Owner({ name: `${kind}-${loaded}` });
      await save(owner);
      const target = await findOne(Owner, owner.id);
      if (loaded) await getRelated(target, 'profile');
      const input = kind === 'id' ? profile.id : kind === 'json' ? { id: profile.id, label: 'json-updated' } : profile;
      const addCallback = await patch(target, 'patchAdd', 'profile', input);
      const afterAdd = {
        loaded: target.isLoaded('profile'),
        profileId: target.get('profile')?.id ?? null,
        storedOwnerId: Profile.store.find((row: Dynamic) => row.id === profile.id)?.[foreignKey] ?? null,
      };
      const removeCallback = await patch(target, 'patchRemove', 'profile', input);
      observations[`${loaded ? 'loaded' : 'unloaded'}-${kind}`] = {
        addCallback,
        afterAdd,
        afterRemove: {
          profile: target.get('profile')?.id ?? null,
          storedOwnerId: Profile.store.find((row: Dynamic) => row.id === profile.id)?.[foreignKey] ?? null,
        },
        removeCallback,
      };
    }
  }

  const owner = new Owner({ name: 'array-error' });
  await save(owner);
  const profile = new Profile({ label: 'array-error' });
  await save(profile);
  observations.arrayError = await patch(owner, 'patchAdd', 'profile', [profile]);
  observations.missingError = await patch(owner, 'patchAdd', 'profile', null);
  return observations;
}

async function observeCollectionLifecycle(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  let Parent: Dynamic;
  let Child: Dynamic;
  Parent = Backbone.Model.extend({
    model_name: 'CollectionLifecycleParent',
    schema() {
      return { children: () => ['hasMany', Child, { as: 'parent' }] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: 'CollectionLifecycleChild',
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
    },
  });
  configure(ORM, Parent);
  configure(ORM, Child);
  const parent = new Parent();
  const first = new Child({ id: 1 });
  const second = new Child({ id: 2 });
  parent.set('children', [first]);
  const collection = parent.get('children');
  collection.add(second);
  const afterAdd = [first.get('parent') === parent, second.get('parent') === parent];
  collection.remove(first);
  const afterRemove = [first.get('parent') ?? null, second.get('parent') === parent];
  collection.reset([first]);
  const afterReset = [first.get('parent') === parent, second.get('parent') ?? null, collection.models.map((model: Dynamic) => model.id)];
  Parent.relation('children').releaseModel(parent);
  const afterManyRelease = {
    collectionLength: collection.length,
    parentOrmMissing: parent._orm === undefined,
  };

  let OneOwner: Dynamic;
  let Profile: Dynamic;
  OneOwner = Backbone.Model.extend({
    model_name: 'OneLifecycleOwner',
    schema() {
      return { profile: () => ['hasOne', Profile, { as: 'owner' }] };
    },
  });
  Profile = Backbone.Model.extend({
    model_name: 'OneLifecycleProfile',
    schema() {
      return { owner: () => ['belongsTo', OneOwner, { as: 'profile' }] };
    },
  });
  configure(ORM, OneOwner);
  configure(ORM, Profile);
  const oneOwner = new OneOwner();
  const profile = new Profile({ id: 1 });
  oneOwner.set('profile', profile);
  OneOwner.relation('profile').releaseModel(oneOwner);
  const replacement = new Profile({ id: 2 });
  oneOwner.set('profile', replacement);
  return {
    afterAdd,
    afterManyRelease,
    afterOneRelease: {
      oldBacklinkRetained: profile.get('owner') === oneOwner,
      ormMissing: oneOwner._orm === undefined,
      profileAfterRelease: oneOwner.attributes.profile?.id ?? null,
      replacementBacklinkInstalled: replacement.get('owner') === oneOwner,
    },
    afterRemove,
    afterReset,
  };
}

async function observeRelationCursor(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  ORM.configure({ model_cache: { enabled: false }, naming_conventions: 'default' });
  let Parent: Dynamic;
  let Child: Dynamic;
  Parent = Backbone.Model.extend({
    model_name: 'RelationCursorParent',
    schema() {
      return { children: () => ['hasMany', Child, { as: 'parent' }] };
    },
  });
  Child = Backbone.Model.extend({
    model_name: 'RelationCursorChild',
    schema() {
      return { parent: () => ['belongsTo', Parent, { as: 'children' }] };
    },
  });
  configure(ORM, Parent);
  configure(ORM, Child);
  const children = [new Child({ rank: 1 }), new Child({ rank: 2 }), new Child({ rank: 3 })];
  for (const child of children) await save(child);
  const parent = new Parent({ children });
  await save(parent);
  const relation = Parent.relation('children');
  const count = await callbackResult((callback) => relation.cursor(parent, 'children').count(callback));
  const page = await callbackResult((callback) => relation.cursor(parent, 'children', { $sort: ['rank'] }).offset(1).limit(1).toJSON(callback));
  const idValues = await callbackResult((callback) => relation.cursor(parent, relation.virtual_id_accessor, { $sort: ['rank'] }).toJSON(callback));
  return {
    count,
    idValues,
    page: page.map((row: Dynamic) => ({ id: row.id, rank: row.rank })),
  };
}

function captureError(operation: () => unknown): string | null {
  try {
    operation();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

function observeUnsupportedFields(ORM: Dynamic, Backbone: Dynamic): Record<string, unknown> {
  const TooMany = Backbone.Model.extend({ model_name: 'UnsupportedTooMany', schema() { return { bad: ['String', {}, {}] }; } });
  const NonString = Backbone.Model.extend({ model_name: 'UnsupportedNonString', schema() { return { bad: { type: 7 } }; } });
  const UnknownString = Backbone.Model.extend({ model_name: 'UnsupportedUnknownString', schema() { return { custom: 'CustomScalar' }; } });
  const unknown = new ORM.Schema(UnknownString);
  unknown.initialize();
  return {
    nonString: captureError(() => new ORM.Schema(NonString).initialize()),
    tooMany: captureError(() => new ORM.Schema(TooMany).initialize()),
    unknownString: unknown.field('custom'),
  };
}

export default async function observeRelationOperations(ORM: Dynamic, Backbone: Dynamic): Promise<Record<string, unknown>> {
  return {
    collectionLifecycle: await observeCollectionLifecycle(ORM, Backbone),
    cursor: await observeRelationCursor(ORM, Backbone),
    manyPatchInputs: await observeManyPatchInputs(ORM, Backbone),
    onePatchInputs: await observeOnePatchInputs(ORM, Backbone),
    unsupportedFields: observeUnsupportedFields(ORM, Backbone),
  };
}
