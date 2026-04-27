import type { SuppressionEntry, SuppressionList } from './types.js';

export type CreateSuppressionListOptions = {
  get: (email: string) => Promise<SuppressionEntry | null>;
  set: (email: string, entry: SuppressionEntry) => Promise<void>;
  del: (email: string) => Promise<void>;
};

const normalize = (email: string): string => email.trim().toLowerCase();

/**
 * Build a `SuppressionList` from any storage backend.
 *
 * Wraps the supplied `get` / `set` / `del` so emails are normalized
 * (trimmed and lower-cased) before being passed through. Use this when
 * adapting Redis, a database table, or any other store to the
 * `SuppressionList` contract.
 *
 * ```ts
 * const redisList = createSuppressionList({
 *   get: async (email) => {
 *     const json = await redis.get(`suppression:${email}`);
 *     return json ? JSON.parse(json) : null;
 *   },
 *   set: async (email, entry) => {
 *     await redis.set(`suppression:${email}`, JSON.stringify(entry));
 *   },
 *   del: async (email) => {
 *     await redis.del(`suppression:${email}`);
 *   },
 * });
 * ```
 */
export const createSuppressionList = (opts: CreateSuppressionListOptions): SuppressionList => {
  return {
    async get(email) {
      return opts.get(normalize(email));
    },
    async set(email, entry) {
      return opts.set(normalize(email), entry);
    },
    async del(email) {
      return opts.del(normalize(email));
    },
  };
};
