import { cacheSyncWraps } from '../cache/CacheSync.ts';
import BaseCursor from '../cursor/Cursor.ts';
import { preflightRelationDeletion } from '../schema/cleanup.ts';
import type { RelationCleanup } from '../schema/contracts.ts';
import type { BackboneORMRuntime, CollectionConstructor, CollectionSync, MemoryCapabilities, ModelConstructor, ModelSync, SyncFactory } from '../types.ts';
import type { MemoryModelConstructor, MemoryRuntime, RuntimeCursorConstructor } from './contracts.ts';
import MemoryCursor, { installMemoryCursorDependencies } from './MemoryCursor.ts';
import MemorySync, { installMemorySyncDependencies } from './MemorySync.ts';
import { memorySyncStateKey, type OwnedMemoryDeletion } from './ownership.ts';

interface MemoryConfiguration {
  extensions: Map<string, ExtensionOwnership>;
  originalFunctions?: object;
  rawSchema?: PropertyDescriptor;
  schemaAccessor?: unknown;
  sync: RuntimeSync;
}

interface MemorySyncState {
  configurations: WeakMap<PersistenceConstructor, MemoryConfiguration>;
  owners: WeakMap<RuntimeSync, PersistenceConstructor>;
  sync: SyncFactory;
  completedDeletionSyncs: WeakSet<RuntimeSync>;
  deletionWorkers: WeakMap<RuntimeSync, OwnedMemoryDeletion>;
  currentDeletionSyncs: WeakMap<RuntimeSync, () => boolean>;
}

interface ExtensionOwnership {
  installed: unknown;
  original: unknown;
}

interface PersistenceConstructor {
  new (...arguments_: never[]): Backbone.Collection | Backbone.Model;
  model_name?: string;
  name?: string;
  prototype: Backbone.Collection | Backbone.Model;
}

type RuntimeSync = CollectionSync | ModelSync;
type ModelPrototypeWithOriginals = Backbone.Model & {
  _orm_original_fns?: Record<string, unknown>;
};

type RuntimeWithMemoryState = BackboneORMRuntime & {
  [memorySyncStateKey]?: MemorySyncState;
};

const hasOwn = (value: object, key: PropertyKey): boolean => Reflect.getOwnPropertyDescriptor(value, key) !== undefined;

const memoryCapabilities: MemoryCapabilities = {
  dynamic: true,
  embed: true,
  json: true,
  manual_ids: true,
  self_reference: true,
  unique: true,
};

function ancestorConfigurations(type: PersistenceConstructor, configurations: MemorySyncState['configurations']): Array<[PersistenceConstructor, MemoryConfiguration]> {
  const ancestors: Array<[PersistenceConstructor, MemoryConfiguration]> = [];
  let prototype = Object.getPrototypeOf(type.prototype) as (Backbone.Collection | Backbone.Model) | null;

  while (prototype && prototype !== Object.prototype) {
    const ancestor = prototype.constructor as PersistenceConstructor;
    const configuration = configurations.get(ancestor);
    if (ancestor !== type && configuration) ancestors.push([ancestor, configuration]);
    prototype = Object.getPrototypeOf(prototype) as (Backbone.Collection | Backbone.Model) | null;
  }
  return ancestors;
}

function isolateInheritedState(modelType: MemoryModelConstructor, ancestors: Array<[PersistenceConstructor, MemoryConfiguration]>): void {
  const sharesAncestorValue = (key: 'cache' | 'cuid' | 'store'): boolean => ancestors.some(([ancestor]) => modelType[key] !== undefined && modelType[key] === (ancestor as MemoryModelConstructor)[key]);

  if (!hasOwn(modelType, 'store') || sharesAncestorValue('store')) modelType.store = [];
  if (!hasOwn(modelType, 'cuid') || sharesAncestorValue('cuid')) modelType.cuid = undefined;
  if (!hasOwn(modelType, 'cache') || sharesAncestorValue('cache')) modelType.cache = undefined;
}

function findPrototypeDescriptor(prototype: object, key: PropertyKey): { descriptor: PropertyDescriptor; owner: object } | undefined {
  let current: object | null = prototype;
  while (current && current !== Object.prototype) {
    const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
    if (descriptor) return { descriptor, owner: current };
    current = Object.getPrototypeOf(current);
  }
}

function isolateInheritedSchema(modelType: MemoryModelConstructor, configurations: MemorySyncState['configurations']): PropertyDescriptor | undefined {
  const inherited = findPrototypeDescriptor(modelType.prototype, 'schema');
  if (!inherited) return;

  const owner = inherited.owner.constructor as PersistenceConstructor;
  const ownerConfiguration = configurations.get(owner);
  if (!ownerConfiguration || inherited.descriptor.value !== ownerConfiguration.schemaAccessor) return inherited.descriptor;

  const rawSchema = ownerConfiguration.rawSchema;
  Object.defineProperty(modelType.prototype, 'schema', rawSchema ?? { configurable: true, enumerable: true, value: undefined, writable: true });
  return rawSchema;
}

function isolateInheritedExtensions(modelType: MemoryModelConstructor, ancestors: Array<[PersistenceConstructor, MemoryConfiguration]>): void {
  const prototype = modelType.prototype as ModelPrototypeWithOriginals;
  for (const [, configuration] of ancestors) {
    for (const [key, extension] of configuration.extensions) {
      if (Reflect.get(prototype, key) === extension.installed) Reflect.set(prototype, key, extension.original);
    }
  }

  const originalFunctions = prototype._orm_original_fns;
  if (ancestors.some(([, configuration]) => configuration.originalFunctions === originalFunctions)) {
    Object.defineProperty(prototype, '_orm_original_fns', { configurable: true, value: undefined, writable: true });
  }
}

function captureExtensions(modelType: MemoryModelConstructor): Pick<MemoryConfiguration, 'extensions' | 'originalFunctions'> {
  const prototype = modelType.prototype as ModelPrototypeWithOriginals;
  const originalFunctions = hasOwn(prototype, '_orm_original_fns') ? prototype._orm_original_fns : undefined;
  const extensions = new Map<string, ExtensionOwnership>();
  if (originalFunctions) {
    for (const [key, original] of Object.entries(originalFunctions)) {
      extensions.set(key, { installed: Reflect.get(prototype, key), original });
    }
  }
  return { extensions, originalFunctions };
}

export default function installOwnedSync(runtime: BackboneORMRuntime, patchRemove: RelationCleanup): void {
  const statefulRuntime = runtime as RuntimeWithMemoryState;
  const installedState = statefulRuntime[memorySyncStateKey];
  if (installedState) {
    runtime.sync = installedState.sync;
    return;
  }

  const memoryRuntime = runtime as unknown as MemoryRuntime;
  installMemorySyncDependencies({
    Cursor: MemoryCursor as unknown as RuntimeCursorConstructor,
    JSONUtils: memoryRuntime.JSONUtils,
    Schema: memoryRuntime.Schema,
    Utils: memoryRuntime.Utils,
    patchRemove: (modelType, model, callback, context) => patchRemove(modelType as unknown as Parameters<RelationCleanup>[0], model as Parameters<RelationCleanup>[1], callback, context),
    underscore: memoryRuntime._,
  });
  installMemoryCursorDependencies(memoryRuntime.JSONUtils, memoryRuntime.Utils, memoryRuntime.DateUtils, memoryRuntime._, memoryRuntime.Queue);
  runtime.Cursor = BaseCursor as unknown as typeof runtime.Cursor;
  const configurations: MemorySyncState['configurations'] = new WeakMap();
  const owners: MemorySyncState['owners'] = new WeakMap();
  const completedDeletionSyncs: MemorySyncState['completedDeletionSyncs'] = new WeakSet();
  const deletionWorkers: MemorySyncState['deletionWorkers'] = new WeakMap();
  const currentDeletionSyncs: MemorySyncState['currentDeletionSyncs'] = new WeakMap();

  let sync: SyncFactory;
  const configurePersistence = function ownedMemorySync(type: PersistenceConstructor): RuntimeSync {
    const currentSync = type.prototype.sync as RuntimeSync;
    const configuration = configurations.get(type);
    const currentOwner = owners.get(currentSync);
    const isCollection = type.prototype === runtime.Backbone.Collection.prototype || type.prototype instanceof runtime.Backbone.Collection || (!(type.prototype instanceof runtime.Backbone.Model) && runtime.Utils.isCollection(new type()));
    const defaultSync = isCollection ? runtime.Backbone.Collection.prototype.sync : runtime.Backbone.Model.prototype.sync;

    if (currentSync !== defaultSync && !currentOwner) {
      const ownership = hasOwn(type.prototype, 'sync') ? 'own' : 'inherited';
      const name = type.model_name ?? type.name ?? (isCollection ? '(anonymous collection)' : '(anonymous model)');
      throw new Error(`Cannot configure ${name} with memory sync: its ${ownership} sync adapter is not owned by backbone-orm`);
    }

    if (configuration) {
      type.prototype.sync = configuration.sync;
      return configuration.sync;
    }

    if (isCollection) {
      const collectionType = type as CollectionConstructor<Backbone.Collection>;
      const declaredModelType = collectionType.prototype.model as ModelConstructor<Backbone.Model> | undefined;
      if (declaredModelType && declaredModelType !== runtime.Backbone.Model) {
        const modelSync = declaredModelType.prototype.sync;
        const modelOwner = owners.get(modelSync);
        if (modelSync !== runtime.Backbone.Model.prototype.sync && !modelOwner) {
          const name = declaredModelType.model_name ?? declaredModelType.name ?? '(anonymous model)';
          throw new Error(`Cannot configure collection model ${name} with memory sync: its sync adapter is not owned by backbone-orm`);
        }
        if (modelOwner && !configurations.get(declaredModelType)) configurePersistence(declaredModelType);
      }
      const modelType = runtime.Utils.configureCollectionModelType(collectionType, sync);
      const configuredSync = modelType.prototype.sync;
      collectionType.prototype.sync = configuredSync;
      configurations.set(type, { extensions: new Map(), sync: configuredSync });
      return configuredSync;
    }

    const memoryModelType = type as MemoryModelConstructor;
    const ancestors = ancestorConfigurations(type, configurations);
    isolateInheritedState(memoryModelType, ancestors);
    const rawSchema = isolateInheritedSchema(memoryModelType, configurations);
    isolateInheritedExtensions(memoryModelType, ancestors);
    const memorySync = new MemorySync(memoryModelType);
    const rawSync = function memoryModelSync(_method: string, ...arguments_: unknown[]): unknown {
      const method = _method;
      memorySync.initialize();
      if (method === 'createSync') {
        const target = arguments_[0];
        return configurePersistence(target as PersistenceConstructor);
      }
      if (method === 'sync') return memorySync;
      if (method === 'isRemote') return false;
      if (method === 'schema') return memorySync.schema;
      if (method === 'tableName') return undefined;
      const implementation = Reflect.get(memorySync, method);
      if (implementation) return (implementation as { apply: (receiver: MemorySync<MemoryModelConstructor>, arguments_: unknown[]) => unknown }).apply(memorySync, arguments_);
    } as ModelSync;
    memoryModelType.prototype.sync = rawSync;
    memoryRuntime.Utils.configureModelType(memoryModelType);
    const configuredSync = memoryRuntime.model_cache.configureSync(memoryModelType, rawSync);
    const extensionState = captureExtensions(memoryModelType);
    configurations.set(memoryModelType, {
      ...extensionState,
      rawSchema,
      schemaAccessor: Reflect.get(memoryModelType.prototype, 'schema'),
      sync: configuredSync,
    });
    owners.set(configuredSync, memoryModelType);
    completedDeletionSyncs.add(configuredSync);
    const deletionWorker: OwnedMemoryDeletion = {
      preflight: () => {
        memorySync.initialize();
        return preflightRelationDeletion(memoryModelType as unknown as Parameters<typeof preflightRelationDeletion>[0]);
      },
      destroy: (query, callback, acquired) => memorySync.destroyRows(query, callback, acquired),
    };
    for (const ownedSync of [rawSync, configuredSync]) {
      owners.set(ownedSync, memoryModelType);
      completedDeletionSyncs.add(ownedSync);
      deletionWorkers.set(ownedSync, deletionWorker);
      currentDeletionSyncs.set(ownedSync, ownedSync === rawSync ? () => true : () => cacheSyncWraps(ownedSync as ModelSync, rawSync));
    }
    memoryModelType.prototype.sync = configuredSync;
    return configuredSync;
  };

  sync = configurePersistence as SyncFactory;

  sync.Cursor = MemoryCursor as unknown as SyncFactory['Cursor'];
  sync.Sync = MemorySync;
  sync.capabilities = () => memoryCapabilities;
  const state: MemorySyncState = { configurations, owners, sync, completedDeletionSyncs, deletionWorkers, currentDeletionSyncs };
  Object.defineProperty(statefulRuntime, memorySyncStateKey, { value: state });
  runtime.sync = sync;
}
