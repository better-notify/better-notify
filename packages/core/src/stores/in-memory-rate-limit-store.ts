import type { RateLimitAlgorithm, RateLimitRecord, RateLimitStore } from './types.js';

type FixedEntry = { count: number; expireAtMs: number };

export const inMemoryRateLimitStore = (): RateLimitStore => {
  const fixed = new Map<string, FixedEntry>();
  const sliding = new Map<string, number[]>();

  const recordFixed = (key: string, windowMs: number, now: number): RateLimitRecord => {
    const entry = fixed.get(key);
    if (!entry || entry.expireAtMs <= now) {
      const fresh = { count: 1, expireAtMs: now + windowMs };
      fixed.set(key, fresh);
      return { count: 1, resetAtMs: fresh.expireAtMs };
    }
    entry.count += 1;
    return { count: entry.count, resetAtMs: entry.expireAtMs };
  };

  const recordSliding = (key: string, windowMs: number, now: number): RateLimitRecord => {
    const cutoff = now - windowMs;
    const log = sliding.get(key) ?? [];
    const trimmed: number[] = [];
    for (const ts of log) {
      if (ts > cutoff) trimmed.push(ts);
    }
    trimmed.push(now);
    sliding.set(key, trimmed);
    const oldest = trimmed[0] as number;
    return { count: trimmed.length, resetAtMs: oldest + windowMs };
  };

  return {
    async record(key: string, windowMs: number, algorithm: RateLimitAlgorithm) {
      const now = Date.now();
      return algorithm === 'fixed'
        ? recordFixed(key, windowMs, now)
        : recordSliding(key, windowMs, now);
    },
  };
};
