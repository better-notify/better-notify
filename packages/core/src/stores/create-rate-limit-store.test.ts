import { describe, it, expect } from 'vitest';
import { createRateLimitStore } from './create-rate-limit-store.js';

describe('createRateLimitStore', () => {
  it('delegates to the provided record function', async () => {
    const store = createRateLimitStore({
      record: async (key, windowMs, _algorithm) => ({
        count: 3,
        resetAtMs: Date.now() + windowMs,
      }),
    });
    const result = await store.record('user:1', 60_000, 'fixed');
    expect(result.count).toBe(3);
    expect(result.resetAtMs).toBeGreaterThan(Date.now());
  });

  it('passes key, window, and algorithm through', async () => {
    let captured: { key: string; windowMs: number; algorithm: string } | null = null;
    const store = createRateLimitStore({
      record: async (key, windowMs, algorithm) => {
        captured = { key, windowMs, algorithm };
        return { count: 1, resetAtMs: Date.now() + windowMs };
      },
    });
    await store.record('tenant:acme', 30_000, 'sliding');
    expect(captured).toEqual({ key: 'tenant:acme', windowMs: 30_000, algorithm: 'sliding' });
  });
});
