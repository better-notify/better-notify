import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inMemoryIdempotencyStore } from './in-memory-idempotency-store.js';

type SendResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  envelope: { from: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

const makeResult = (id: string): SendResult => ({
  messageId: id,
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
});

describe('inMemoryIdempotencyStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null for unknown keys', async () => {
    const store = inMemoryIdempotencyStore();
    expect(await store.get('nope')).toBeNull();
  });

  it('round-trips a result', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryIdempotencyStore();
    const result = makeResult('m1');
    await store.set('k', result, 60_000);
    expect(await store.get('k')).toEqual(result);
  });

  it('expires entries after ttl', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const store = inMemoryIdempotencyStore();
    await store.set('k', makeResult('m1'), 1000);
    vi.advanceTimersByTime(1001);
    expect(await store.get('k')).toBeNull();
  });
});
