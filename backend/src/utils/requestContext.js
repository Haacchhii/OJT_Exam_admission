import { AsyncLocalStorage } from 'async_hooks';

const store = new AsyncLocalStorage();

export function runWithRequestContext(context, callback) {
  return store.run(context || {}, callback);
}

export function getRequestContext() {
  return store.getStore() || null;
}
