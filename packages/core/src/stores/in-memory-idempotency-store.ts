import { createIdempotencyStore } from './create-idempotency-store.js';
import type { SendResult } from '../types.js';
import type { IdempotencyStore } from './types.js';

type Entry = { result: SendResult; expiresAtMs: number };

export const inMemoryIdempotencyStore = (): IdempotencyStore => {
  const map = new Map<string, Entry>();
  return createIdempotencyStore({
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
