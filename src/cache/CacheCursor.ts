import type { CursorCallback } from '../cursor/contracts.ts';
import type { MemoryModelConstructor } from '../memory/contracts.ts';
import MemoryCursor, { type MemoryCursorInstance } from '../memory/MemoryCursor.ts';

export type WrappedSync = (method: string, ...arguments_: unknown[]) => unknown;

export interface CacheCursorInstance extends MemoryCursorInstance {
  model_type: MemoryModelConstructor;
  wrapped_sync_fn: WrappedSync;
}

function CacheCursor(this: CacheCursorInstance, query: unknown, options: { model_type: MemoryModelConstructor; wrapped_sync_fn: WrappedSync }): void {
  MemoryCursor.call(this, query, { model_type: options.model_type, store: [] });
  this.wrapped_sync_fn = options.wrapped_sync_fn;
}

Object.setPrototypeOf(CacheCursor.prototype, MemoryCursor.prototype);
Object.setPrototypeOf(CacheCursor, MemoryCursor);
CacheCursor.prototype.constructor = CacheCursor;
CacheCursor.prototype.toJSON = function toJSON(this: CacheCursorInstance, callback: CursorCallback): unknown {
  return (this.wrapped_sync_fn('cursor', { ...this._find, ...this._cursor }) as { toJSON(callback: CursorCallback): unknown }).toJSON(callback);
};

export default CacheCursor as unknown as {
  new (query: unknown, options: { model_type: MemoryModelConstructor; wrapped_sync_fn: WrappedSync }): CacheCursorInstance;
  (this: CacheCursorInstance, query: unknown, options: { model_type: MemoryModelConstructor; wrapped_sync_fn: WrappedSync }): void;
  prototype: CacheCursorInstance;
};
