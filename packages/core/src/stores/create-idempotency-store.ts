import type { IdempotencyStore } from './types.js';

export type CreateIdempotencyStoreOptions<TResult = unknown> = {
  get: (key: string) => Promise<TResult | null>;
  set: (key: string, result: TResult, ttlMs: number) => Promise<void>;
};

/**
 * Build an `IdempotencyStore` from any storage backend.
 *
 * Use this when adapting Redis, a database table, or any other key-value
 * store with TTL support to the `IdempotencyStore` contract.
 *
 * ```ts
 * const redisStore = createIdempotencyStore({
 *   get: async (key) => {
 *     const json = await redis.get(`idem:${key}`);
 *     return json ? JSON.parse(json) : null;
 *   },
 *   set: async (key, result, ttlMs) => {
 *     await redis.set(`idem:${key}`, JSON.stringify(result), 'PX', ttlMs);
 *   },
 * });
 * ```
 */
export const createIdempotencyStore = <TResult = unknown>(
  opts: CreateIdempotencyStoreOptions<TResult>,
): IdempotencyStore<TResult> => {
  return {
    get: opts.get,
    set: opts.set,
  };
};
