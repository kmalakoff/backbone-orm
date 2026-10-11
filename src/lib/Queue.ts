import type { QueueCallback, QueueInstance, QueueTask } from '../types.ts';

export default class Queue implements QueueInstance {
  parallelism: number;
  tasks: QueueTask[];
  running_count: number;
  error: unknown;
  await_callback: QueueCallback | null;
  await_called?: boolean;

  constructor(parallelism?: number) {
    this.parallelism = parallelism as number;
    this._doneTask = this._doneTask.bind(this);
    if (!this.parallelism) this.parallelism = Infinity;
    this.tasks = [];
    this.running_count = 0;
    this.error = null;
    this.await_callback = null;
  }

  defer(callback: QueueTask): unknown {
    this.tasks.push(callback);
    return this._runTasks();
  }

  await(callback: QueueCallback): unknown {
    if (this.await_callback) throw new Error(`Awaiting callback was added twice: ${String(callback)}`);
    this.await_callback = callback;
    if (this.error || !(this.tasks.length + this.running_count)) return this._callAwaiting();
  }

  _doneTask(error?: Error | null): unknown {
    this.running_count -= 1;
    if (!this.error) this.error = error;
    return this._runTasks();
  }

  _runTasks(): unknown {
    if (this.error || !(this.tasks.length + this.running_count)) return this._callAwaiting();
    while (this.running_count < this.parallelism) {
      if (!this.tasks.length) return;
      const current = this.tasks.shift();
      this.running_count += 1;
      current?.(this._doneTask);
    }
  }

  _callAwaiting(): unknown {
    if (this.await_called || !this.await_callback) return;
    this.await_called = true;
    return this.await_callback(this.error as Error | null | undefined);
  }
}
