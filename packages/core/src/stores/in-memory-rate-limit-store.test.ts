import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inMemoryRateLimitStore } from './in-memory-rate-limit-store.js';

describe('inMemoryRateLimitStore (fixed)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts attempts within the window', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryRateLimitStore();
    const a = await store.record('k', 1000, 'fixed');
    expect(a.count).toBe(1);
    const b = await store.record('k', 1000, 'fixed');
    expect(b.count).toBe(2);
    const c = await store.record('k', 1000, 'fixed');
    expect(c.count).toBe(3);
  });

  it('resets after window expires', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryRateLimitStore();
    await store.record('k', 1000, 'fixed');
    await store.record('k', 1000, 'fixed');
    vi.advanceTimersByTime(1001);
    const r = await store.record('k', 1000, 'fixed');
    expect(r.count).toBe(1);
  });

  it('isolates keys', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryRateLimitStore();
    await store.record('a', 1000, 'fixed');
    await store.record('a', 1000, 'fixed');
    const r = await store.record('b', 1000, 'fixed');
    expect(r.count).toBe(1);
  });
});

describe('inMemoryRateLimitStore (sliding)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('trims entries older than the window', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryRateLimitStore();
    await store.record('k', 1000, 'sliding');
    vi.advanceTimersByTime(500);
    await store.record('k', 1000, 'sliding');
    vi.advanceTimersByTime(600);
    const r = await store.record('k', 1000, 'sliding');
    expect(r.count).toBe(2);
  });

  it('reports resetAt as oldest entry + window', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryRateLimitStore();
    const first = await store.record('k', 1000, 'sliding');
    expect(first.resetAtMs).toBe(Date.now() + 1000);
  });
});
