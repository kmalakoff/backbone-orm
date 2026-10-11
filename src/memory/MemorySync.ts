import type Backbone from 'backbone';
import type { RelationalModelConstructor } from '../schema/contracts.ts';
import { type DeletionContext, deletionConflict, deletionRowIndex, ownsDeletionRow } from '../schema/deletion.ts';

import type { ErrorCallback, MemoryModelConstructor, MemorySyncDependencies, MemorySyncOptions, ModelJSON, RuntimeCursor, RuntimeSchema } from './contracts.ts';
import type { DeletionBatchAcquired } from './ownership.ts';

const DESTROY_BATCH_LIMIT = 2000;

let dependencies: MemorySyncDependencies | undefined;

export function installMemorySyncDependencies(value: MemorySyncDependencies): void {
  dependencies = value;
}

function getDependencies(): MemorySyncDependencies {
  if (!dependencies) throw new Error('MemorySync dependencies are not installed');
  return dependencies;
}

export default class MemorySync<C extends MemoryModelConstructor = MemoryModelConstructor> {
  id = 0;
  id_attribute: string;
  id_type?: unknown;
  is_initialized?: boolean;
  manual_id?: boolean;
  model_type: C;
  schema: RuntimeSchema;
  store: ModelJSON[];

  constructor(modelType: C) {
    const { Schema, Utils } = getDependencies();
    this.model_type = modelType;
    this.model_type.model_name = Utils.findOrGenerateModelName(this.model_type);
    this.schema = new Schema(this.model_type);
    if (!this.schema.field('id')?.type) this.schema.type('id', 'Integer');
    if (this.model_type.store) this.store = this.model_type.store;
    else {
      this.store = [];
      this.model_type.store = this.store;
    }
    this.id_attribute = this.model_type.prototype.idAttribute;
    this.deleteCB = this.deleteCB.bind(this);
  }

  initialize(): void {
    if (this.is_initialized) return;
    this.is_initialized = true;
    this.schema.initialize();
    if (this.schema.field('id')?.manual) this.manual_id = true;
    this.id_type = this.schema.idType();
  }

  read(model: Backbone.Collection | InstanceType<C>, options: MemorySyncOptions): unknown {
    const { JSONUtils } = getDependencies();
    if (Reflect.get(model, 'models')) return options.success(this.store.map((modelJSON) => JSONUtils.deepClone(modelJSON)));

    const modelInstance = model as InstanceType<C>;
    const modelJSON = this.get(modelInstance.id);
    if (!modelJSON) return options.error(new Error(`Model not found with id: ${modelInstance.id}`));
    return options.success(JSONUtils.deepClone(modelJSON));
  }

  create(model: InstanceType<C>, options: MemorySyncOptions): unknown {
    const { JSONUtils } = getDependencies();
    if (this.manual_id) {
      return options.error(new Error(`Create should not be called for a manual id. Set an id before calling save. Model name: ${this.model_type.model_name}. Model: ${JSONUtils.stringify(model.toJSON())}`));
    }

    this.id += 1;
    model.set(this.id_attribute, this.id_type === 'String' ? `${this.id}` : this.id);
    const modelJSON = model.toJSON() as ModelJSON;
    this.store.splice(this.insertIndexOf(model.id), 0, modelJSON);
    return options.success(JSONUtils.deepClone(modelJSON));
  }

  update(model: InstanceType<C>, options: MemorySyncOptions): unknown {
    const { JSONUtils } = getDependencies();
    const index = this.insertIndexOf(model.id);
    const create = index >= this.store.length || this.store[index][this.id_attribute] !== model.id;
    if (!this.manual_id && create) {
      return options.error(new Error(`Update cannot create a new model without manual option. Set an id before calling save. Model name: ${this.model_type.model_name}. Model: ${JSONUtils.stringify(model.toJSON())}`));
    }

    const modelJSON = model.toJSON() as ModelJSON;
    if (create) this.store.splice(index, 0, modelJSON);
    else this.store[index] = modelJSON;
    return options.success(JSONUtils.deepClone(modelJSON));
  }

  delete(model: InstanceType<C>, options: MemorySyncOptions): unknown {
    return this.deleteCB(model, (error) => (error ? options.error(error) : options.success()));
  }

  deleteCB(model: InstanceType<C> | ModelJSON, callback: ErrorCallback): unknown {
    const id = (model instanceof this.model_type ? Reflect.get(model, 'id') : Reflect.get(model, this.id_attribute)) as unknown;
    const index = this.indexOf(id);
    if (index < 0) return callback(new Error(`Model not found. Type: ${this.model_type.model_name}. Id: ${id}`));
    return this.deleteCaptured(model, this.store[index], id, this.store, callback);
  }

  private deleteCaptured(model: InstanceType<C> | ModelJSON, row: ModelJSON, id: unknown, store: ModelJSON[], callback: ErrorCallback, removed?: (row: ModelJSON, id: unknown) => unknown): unknown {
    const context: DeletionContext = {
      modelType: this.model_type as unknown as RelationalModelConstructor,
      idAttribute: this.id_attribute,
      id,
      row,
      store,
      storeOwner: this,
    };
    if (!ownsDeletionRow(context)) return callback(deletionConflict(context));
    let completed = false;
    return getDependencies().patchRemove(
      this.model_type,
      model,
      (error) => {
        if (completed) return;
        completed = true;
        if (error) return callback(error);
        const index = deletionRowIndex(context);
        if (index < 0) return callback(deletionConflict(context));
        store.splice(index, 1);
        removed?.(row, id);
        return callback(error);
      },
      context
    );
  }

  resetSchema(_options: object, callback: ErrorCallback): unknown {
    return this.destroy(callback);
  }

  cursor(query: unknown = {}): RuntimeCursor {
    const { Cursor } = getDependencies();
    return new Cursor(query, { model_type: this.model_type, store: this.store });
  }

  destroy(callback: ErrorCallback): unknown;
  destroy(query: unknown, callback: ErrorCallback): unknown;
  destroy(queryOrCallback: unknown | ErrorCallback, maybeCallback?: ErrorCallback): unknown {
    // biome-ignore lint/complexity/noArguments: Legacy destroy distinguishes its callback overload by argument count.
    const oneArgument = arguments.length === 1;
    const query = oneArgument ? {} : queryOrCallback;
    const callback = (oneArgument ? queryOrCallback : maybeCallback) as ErrorCallback;
    return this.destroyRows(query, callback);
  }

  destroyRows(query: unknown, callback: ErrorCallback, acquired?: DeletionBatchAcquired): unknown {
    const { JSONUtils, Utils } = getDependencies();
    const cursorQuery = typeof query === 'string' || typeof query === 'number' ? { [this.id_attribute]: query } : query;

    if (JSONUtils.isEmptyObject(cursorQuery as object)) {
      const store = this.store;
      const rows = store.slice().reverse();
      const removed = acquired?.(rows.map((row) => ({ row, id: row[this.id_attribute] })));
      return Utils.each(rows, (row, next) => this.deleteCaptured(row, row, row[this.id_attribute], store, next, removed), callback);
    }

    let isDone = false;
    const store = this.store;
    const cursor = this.model_type.cursor?.(cursorQuery).limit(DESTROY_BATCH_LIMIT) as RuntimeCursor;
    const next = (): unknown =>
      cursor.toJSON((error, modelsJSON) => {
        if (error) return callback(error);
        if (this.store !== store) return callback(new Error(`Deletion conflict. Type: ${this.model_type.model_name}. Stored array changed during queried deletion.`));
        if (modelsJSON.length === 0) return callback();
        isDone = modelsJSON.length < DESTROY_BATCH_LIMIT;
        const rows = modelsJSON.map((json) => ({ json, row: this.get(json[this.id_attribute]), id: json[this.id_attribute] }));
        const removed = acquired?.(rows.flatMap(({ row, id }) => (row ? [{ row, id }] : [])));
        return Utils.each(
          rows,
          ({ json, row, id }, nextRow) => {
            if (!row) return nextRow(new Error(`Model not found. Type: ${this.model_type.model_name}. Id: ${id}`));
            return this.deleteCaptured(json, row, id, store, nextRow, removed);
          },
          (deleteError) => {
            if (deleteError || isDone) return callback(deleteError);
            return next();
          }
        );
      });
    return next();
  }

  get(id: unknown): ModelJSON | null {
    const { underscore } = getDependencies();
    const index = underscore.sortedIndex(this.store, { [this.id_attribute]: id }, this.id_attribute);
    if (index >= this.store.length || this.store[index][this.id_attribute] !== id) return null;
    return this.store[index];
  }

  indexOf(id: unknown): number {
    const { underscore } = getDependencies();
    const index = underscore.sortedIndex(this.store, { [this.id_attribute]: id }, this.id_attribute);
    if (index >= this.store.length || this.store[index][this.id_attribute] !== id) return -1;
    return index;
  }

  insertIndexOf(id: unknown): number {
    return getDependencies().underscore.sortedIndex(this.store, { [this.id_attribute]: id }, this.id_attribute);
  }
}
