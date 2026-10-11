import type { BackboneORMRuntime, SchemaConstructor } from '../types.ts';
import createRelationCleanup from './cleanup.ts';
import type { RelationCleanup, RuntimeDatabaseURLConstructor, RuntimeJSONUtils, RuntimeNamingConventions, RuntimeQueueConstructor, RuntimeRelationUtils, RuntimeUnderscore } from './contracts.ts';
import { installSchemaDependencies } from './runtime.ts';
import Schema from './Schema.ts';

const schemaStateKey = Symbol.for('backbone-orm.schema.owned-state');

export interface OwnedSchemaState {
  Schema: SchemaConstructor;
  cleanup: RelationCleanup;
}

type SchemaRuntime = BackboneORMRuntime & {
  DatabaseURL: RuntimeDatabaseURLConstructor;
  JSONUtils: RuntimeJSONUtils;
  Queue: RuntimeQueueConstructor;
  Utils: RuntimeRelationUtils;
  naming_conventions: RuntimeNamingConventions;
  _: RuntimeUnderscore;
  [schemaStateKey]?: OwnedSchemaState;
};

export default function installOwnedSchema(runtime: BackboneORMRuntime): OwnedSchemaState {
  const schemaRuntime = runtime as SchemaRuntime;
  const installed = schemaRuntime[schemaStateKey];
  if (installed) {
    runtime.Schema = installed.Schema;
    return installed;
  }
  installSchemaDependencies({
    Backbone: runtime.Backbone,
    DatabaseURL: schemaRuntime.DatabaseURL,
    JSONUtils: schemaRuntime.JSONUtils,
    Queue: schemaRuntime.Queue,
    Utils: schemaRuntime.Utils,
    namingConventions: () => schemaRuntime.naming_conventions,
    underscore: schemaRuntime._,
  });
  const state: OwnedSchemaState = {
    Schema: Schema as unknown as SchemaConstructor,
    cleanup: createRelationCleanup({ Queue: schemaRuntime.Queue }),
  };
  Object.defineProperty(schemaRuntime, schemaStateKey, { value: state });
  runtime.Schema = state.Schema;
  return state;
}
