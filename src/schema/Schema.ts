import type { RelationalModel, RelationalModelConstructor, RelationContract, RuntimeSchemaField, SchemaContract } from './contracts.ts';
import Many from './Many.ts';
import One from './One.ts';
import { getSchemaDependencies } from './runtime.ts';

const RELATION_VARIANTS: Record<string, 'belongsTo' | 'hasMany' | 'hasOne'> = {
  BelongsTo: 'belongsTo',
  HasMany: 'hasMany',
  HasOne: 'hasOne',
  belongsTo: 'belongsTo',
  belongs_to: 'belongsTo',
  hasMany: 'hasMany',
  hasOne: 'hasOne',
  has_many: 'hasMany',
  has_one: 'hasOne',
};

function nestedType(type: unknown, key: string): unknown {
  if ((typeof type !== 'object' || type === null) && typeof type !== 'function') return;
  const schema = Reflect.get(type, 'schema');
  return typeof schema === 'function' ? (Reflect.apply(schema, type, []) as SchemaContract).type(key) : undefined;
}

export default class Schema implements SchemaContract {
  fields: Record<string, RuntimeSchemaField> = {};
  is_initialized?: boolean;
  model_type: RelationalModelConstructor;
  raw: Record<string, unknown>;
  relations: Record<string, RelationContract> = {};
  type_overrides: Record<string, RuntimeSchemaField>;
  virtual_accessors: Record<string, RelationContract> = {};

  constructor(modelType: RelationalModelConstructor, typeOverrides: Record<string, RuntimeSchemaField> = {}) {
    const { underscore } = getSchemaDependencies();
    this.model_type = modelType;
    this.type_overrides = typeOverrides;
    this.raw = underscore.clone((underscore.result(new this.model_type(), 'schema') as Record<string, unknown> | undefined) || {});
    if (this.raw.id) this._parseField('id', this.raw.id);
  }

  initialize(): void {
    if (this.is_initialized) return;
    this.is_initialized = true;
    for (const [key, info] of Object.entries(this.raw)) this._parseField(key, info);
    for (const relation of Object.values(this.relations)) relation.initialize();
  }

  type(key: string): unknown;
  type(key: string, type: unknown): this;
  type(key: string, type?: unknown): unknown | this {
    // biome-ignore lint/complexity/noArguments: Legacy Schema.type distinguishes its setter overload by argument count.
    if (arguments.length === 2) {
      if (!this.type_overrides[key]) this.type_overrides[key] = {};
      const override = this.type_overrides[key];
      override.type = type;
      return this;
    }
    let other: string | undefined;
    const index = key.indexOf('.');
    if (index >= 0) {
      other = key.slice(index + 1);
      key = key.slice(0, index);
    }
    const resolved = this.type_overrides[key]?.type || this.fields[key]?.type || this.relation(key)?.reverse_model_type || this.reverseRelation(key)?.model_type;
    if (!resolved) return;
    if (this.virtual_accessors[key]) {
      if (other) {
        console.log(`Unexpected other for virtual id key: ${key}.${other}`);
        return;
      }
      return nestedType(resolved, 'id') || resolved;
    }
    return other ? nestedType(resolved, other) : resolved;
  }

  idType(key?: string): unknown {
    if (!key) return this.type('id');
    const type = this.type(key);
    return type ? nestedType(type, 'id') || type : undefined;
  }

  field(key: string): RuntimeSchemaField | RelationContract | undefined {
    return this.fields[key] || this.relation(key);
  }

  relation(key: string): RelationContract | undefined {
    return this.relations[key] || this.virtual_accessors[key];
  }

  reverseRelation(reverseKey: string): RelationContract | null {
    for (const relation of Object.values(this.relations)) {
      if (relation.reverse_relation?.join_key === reverseKey) return relation.reverse_relation;
    }
    return null;
  }

  columns(): string[] {
    const columns = Object.keys(this.fields);
    if (!columns.includes('id')) columns.push('id');
    for (const relation of Object.values(this.relations)) {
      if (relation.type === 'belongsTo' && !relation.isVirtual() && !relation.isEmbedded()) columns.push(relation.foreign_key);
    }
    return columns;
  }

  joinTables(): RelationalModelConstructor[] {
    const joinTables: RelationalModelConstructor[] = [];
    for (const relation of Object.values(this.relations)) {
      if (!relation.isVirtual() && relation.join_table) joinTables.push(relation.join_table);
    }
    return joinTables;
  }

  relatedModels(): RelationalModelConstructor[] {
    const related: RelationalModelConstructor[] = [];
    for (const relation of Object.values(this.relations)) {
      related.push(relation.reverse_model_type);
      if (relation.join_table) related.push(relation.join_table);
    }
    return related;
  }

  allColumns(): string[] {
    return this.columns();
  }

  allRelations(): RelationalModelConstructor[] {
    return this.relatedModels();
  }

  generateBelongsTo(reverseModelType: RelationalModelConstructor): RelationContract {
    const { namingConventions } = getSchemaDependencies();
    const key = namingConventions().attribute(reverseModelType.model_name ?? '');
    const existing = this.relations[key];
    if (existing) return existing;
    if (this.raw[key]) {
      const relation = this._parseField(key, this.raw[key]) as RelationContract;
      relation.initialize();
      return relation;
    }
    const field = ['belongsTo', reverseModelType, { manual_fetch: true }];
    this.raw[key] = field;
    const relation = this._parseField(key, field) as RelationContract;
    relation.initialize();
    return relation;
  }

  static joinTableURL(relation: RelationContract): string {
    const { namingConventions } = getSchemaDependencies();
    const first = namingConventions().tableName(relation.model_type.model_name ?? '');
    const second = namingConventions().tableName(relation.reverse_relation?.model_type.model_name ?? '');
    return first.localeCompare(second) < 0 ? `${first}_${second}` : `${second}_${first}`;
  }

  generateJoinTable(relation: RelationContract): RelationalModelConstructor {
    const { Backbone, DatabaseURL, namingConventions, underscore } = getSchemaDependencies();
    const schema: Record<string, unknown> = {};
    const type = relation.model_type.schema().type('id');
    schema[relation.join_key] = [type, { indexed: true }];
    schema[relation.reverse_relation?.join_key ?? ''] = [relation.reverse_model_type?.schema().type('id') || type, { indexed: true }];
    const url = Schema.joinTableURL(relation);
    const name = namingConventions().modelName(url, true);
    const defineJoinTable = (urlRoot: string): RelationalModelConstructor => {
      class JoinTable extends Backbone.Model {}
      const prototype = JoinTable.prototype as RelationalModel & {
        model_name?: string;
        schema?: unknown;
        sync: Backbone.Model['sync'];
        urlRoot?: unknown;
      };
      prototype.model_name = name;
      prototype.urlRoot = urlRoot;
      prototype.schema = schema;
      prototype.sync = relation.model_type.createSync(JoinTable as unknown as RelationalModelConstructor);
      return JoinTable as unknown as RelationalModelConstructor;
    };
    try {
      const model = new relation.model_type();
      const baseURL = new DatabaseURL(underscore.result(model, 'url')).format({ exclude_table: true });
      return defineJoinTable(`${baseURL}/${url}`);
    } catch {
      return defineJoinTable(`/${url}`);
    }
  }

  private _parseField(key: string, info: unknown): RuntimeSchemaField | RelationContract {
    const { JSONUtils, underscore } = getSchemaDependencies();
    const resolved = underscore.isFunction(info) ? info() : info;
    const options = this._fieldInfoToOptions(resolved);
    if (!options.type) {
      this.fields[key] = options;
      return options;
    }
    const relationType = RELATION_VARIANTS[String(options.type)];
    if (!relationType) {
      if (!underscore.isString(options.type)) throw new Error(`Unexpected type name is not a string: ${JSONUtils.stringify(options)}`);
      this.fields[key] = options;
      return options;
    }
    options.type = relationType;
    const relation = relationType === 'hasMany' ? new Many(this.model_type, key, options) : new One(this.model_type, key, options);
    this.relations[key] = relation;
    if (relation.virtual_id_accessor) this.virtual_accessors[relation.virtual_id_accessor] = relation;
    if (relationType === 'belongsTo') this.virtual_accessors[relation.foreign_key] = relation;
    return relation;
  }

  private _fieldInfoToOptions(input: unknown): Record<string, unknown> {
    const { JSONUtils, underscore } = getSchemaDependencies();
    if (underscore.isString(input)) return { type: input };
    if (!underscore.isArray(input)) return input as Record<string, unknown>;
    let options = input.slice();
    const result: Record<string, unknown> = {};
    if (underscore.isString(options[0])) {
      result.type = options[0];
      options = options.slice(1);
      if (options.length === 0) return result;
    }
    if (underscore.isFunction(options[0])) {
      result.reverse_model_type = options[0];
      options = options.slice(1);
    }
    if (options.length > 1) throw new Error(`Unexpected field options array: ${JSONUtils.stringify(options)}`);
    if (options.length === 1) underscore.extend(result, options[0] as object);
    return result;
  }
}
