import { describe, it, expect } from 'vitest';
import { createIdempotencyStore } from './create-idempotency-store.js';
import type { SendResult } from '../types.js';

const makeResult = (id: string): SendResult => ({
  messageId: id,
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
});

describe('createIdempotencyStore', () => {
  it('forwards get/set to user-supplied storage', async () => {
    const calls: Array<{ op: string; key: string; ttlMs?: number }> = [];
    const backing = new Map<string, SendResult>();
    const store = createIdempotencyStore({
      get: async (key) => {
        calls.push({ op: 'get', key });
        return backing.get(key) ?? null;
      },
      set: async (key, result, ttlMs) => {
        calls.push({ op: 'set', key, ttlMs });
        backing.set(key, result);
      },
    });

    expect(await store.get('k')).toBeNull();
    await store.set('k', makeResult('m1'), 30_000);
    expect(await store.get('k')).toEqual(makeResult('m1'));

    expect(calls).toEqual([
      { op: 'get', key: 'k' },
      { op: 'set', key: 'k', ttlMs: 30_000 },
      { op: 'get', key: 'k' },
    ]);
  });

  it('lets users plug arbitrary backends', async () => {
    const persistent = new Map<string, { result: SendResult; ttlMs: number }>();
    const store = createIdempotencyStore({
      get: async (key) => persistent.get(key)?.result ?? null,
      set: async (key, result, ttlMs) => {
        persistent.set(key, { result, ttlMs });
      },
    });
    await store.set('order:1', makeResult('m-order-1'), 60_000);
    expect(await store.get('order:1')).toEqual(makeResult('m-order-1'));
    expect(persistent.get('order:1')?.ttlMs).toBe(60_000);
  });
});
