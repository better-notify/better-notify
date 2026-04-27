import { createIdempotencyStore } from './create-idempotency-store.js';
import type { IdempotencyStore } from './types.js';

type Entry<TResult> = { result: TResult; expiresAtMs: number };

export const inMemoryIdempotencyStore = <TResult = unknown>(): IdempotencyStore<TResult> => {
  const map = new Map<string, Entry<TResult>>();
  return createIdempotencyStore<TResult>({
    get: async (key) => {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAtMs <= Date.now()) {
        map.delete(key);
        return null;
      }
      return entry.result;
    },
    set: async (key, result, ttlMs) => {
      map.set(key, { result, expiresAtMs: Date.now() + ttlMs });
    },
  });
};
