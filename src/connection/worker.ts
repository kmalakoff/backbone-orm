import type { ConnectionPoolCallback } from '../types.ts';
import type { ConnectionEntry, OwnedConnectionPoolState, OwnedRegistration } from './contracts.ts';

function ownershipError(key: unknown): Error {
  return new Error(`ConnectionPool entry is not owned: ${String(key)}`);
}

function disposalError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  const error = new Error('ConnectionPool disposer threw a non-Error value') as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

export function readConnectionEntry(state: OwnedConnectionPoolState, key: unknown): ConnectionEntry {
  if (!state.cache.has(key)) return { exists: false, value: undefined };
  return { exists: true, value: state.cache.peek(key) };
}

function finishDisposal(state: OwnedConnectionPoolState, key: unknown, registration: OwnedRegistration, error?: Error | null): void {
  const active = registration.active;
  if (!active) return;
  registration.active = undefined;

  if (!error && state.owned.get(key) === registration) {
    const current = readConnectionEntry(state, key);
    if (current.exists && Object.is(current.value, registration.value)) {
      state.owned.delete(key);
      state.cacheDel.call(state.cache, key);
    }
  }

  let callbackFailure: unknown;
  let callbackFailed = false;
  for (const callback of active.callbacks) {
    try {
      callback(error ?? null);
    } catch (error) {
      if (!callbackFailed) callbackFailure = error;
      callbackFailed = true;
    }
  }
  if (callbackFailed) throw callbackFailure;
}

function startDisposer(state: OwnedConnectionPoolState, key: unknown, registration: OwnedRegistration): void {
  let callbackRequested = false;
  let callbackError: Error | null | undefined;
  let disposerReturned = false;
  let disposerFailure: Error | undefined;

  const done = (error?: Error | null): void => {
    if (callbackRequested) return;
    callbackRequested = true;
    if (!disposerReturned) {
      callbackError = error;
      return;
    }
    finishDisposal(state, key, registration, error);
  };

  try {
    registration.disposer(registration.value, done);
  } catch (error) {
    callbackRequested = true;
    disposerFailure = disposalError(error);
  } finally {
    disposerReturned = true;
  }

  if (callbackRequested) finishDisposal(state, key, registration, disposerFailure ?? callbackError);
}

function disposeOwnedRegistrationWorker(state: OwnedConnectionPoolState, key: unknown, registration: OwnedRegistration, callback: ConnectionPoolCallback): void {
  if (registration.active) {
    registration.active.callbacks.push(callback);
    return;
  }

  registration.active = { callbacks: [callback] };
  startDisposer(state, key, registration);
}

export function disposeConnectionWorker(state: OwnedConnectionPoolState, key: unknown, callback: ConnectionPoolCallback): void {
  const current = readConnectionEntry(state, key);
  const registration = state.owned.get(key);

  if (!current.exists) {
    if (registration) state.owned.delete(key);
    callback(null);
    return;
  }
  if (!registration || !Object.is(registration.value, current.value)) {
    if (registration) state.owned.delete(key);
    callback(ownershipError(key));
    return;
  }
  disposeOwnedRegistrationWorker(state, key, registration, callback);
}

export function disposeAllConnectionsWorker(state: OwnedConnectionPoolState, callback: ConnectionPoolCallback): void {
  const entries: Array<{ key: unknown; registration: OwnedRegistration; value: unknown }> = [];
  try {
    state.pool.forEach((value, key) => {
      const registration = state.owned.get(key);
      if (!registration || !Object.is(registration.value, value)) throw ownershipError(key);
      entries.push({ key, registration, value });
    });
  } catch (error) {
    callback(error as Error);
    return;
  }

  if (entries.length === 0) {
    callback(null);
    return;
  }

  const errors: Array<Error | null | undefined> = new Array(entries.length);
  let remaining = entries.length;
  let workersStarted = false;
  const finish = (): void => {
    if (!workersStarted || remaining !== 0) return;
    callback(errors.find((error) => error != null) ?? null);
  };

  for (const [index, entry] of entries.entries()) {
    disposeOwnedRegistrationWorker(state, entry.key, entry.registration, (error) => {
      errors[index] = error;
      remaining -= 1;
      finish();
    });
  }
  workersStarted = true;
  finish();
}
