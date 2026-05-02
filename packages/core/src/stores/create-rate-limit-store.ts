import type { RateLimitAlgorithm, RateLimitRecord, RateLimitStore } from './types.js';

export type CreateRateLimitStoreOptions = {
  record: (
    key: string,
    windowMs: number,
    algorithm: RateLimitAlgorithm,
  ) => Promise<RateLimitRecord>;
};

export const createRateLimitStore = (opts: CreateRateLimitStoreOptions): RateLimitStore => ({
  record: opts.record,
});
