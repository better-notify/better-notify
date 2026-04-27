import { describe, it, expect } from 'vitest';
import { inMemoryIdempotencyStore } from '../stores/in-memory-idempotency-store.js';
import { withIdempotency } from './with-idempotency.js';
import type { Middleware, SendArgsLike } from './types.js';

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

const callMw = async (
  mw: Middleware,
  next: () => Promise<SendResult>,
  args: SendArgsLike = { to: 'x@y.com', input: {} },
): Promise<SendResult> =>
  (await mw({
    input: {},
    ctx: {},
    route: 'welcome',
    messageId: 'test-msg',
    args,
    next,
  })) as SendResult;

describe('withIdempotency', () => {
  it('caches the first send and replays on subsequent calls', async () => {
    const store = inMemoryIdempotencyStore();
    const mw = withIdempotency({ store, key: 'k', ttl: 60_000 });
    let nextCalls = 0;
    const next = async () => {
      nextCalls += 1;
      return makeResult(`m${nextCalls}`);
    };
    const a = await callMw(mw, next);
    const b = await callMw(mw, next);
    expect(a.messageId).toBe('m1');
    expect(b.messageId).toBe('m1');
    expect(nextCalls).toBe(1);
  });

  it('does not cache on failure', async () => {
    const store = inMemoryIdempotencyStore();
    const mw = withIdempotency({ store, key: 'k', ttl: 60_000 });
    let attempts = 0;
    const next = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('boom');
      return makeResult('m-ok');
    };
    await expect(callMw(mw, next)).rejects.toThrow('boom');
    const second = await callMw(mw, next);
    expect(second.messageId).toBe('m-ok');
  });

  it('supports function key derived from input', async () => {
    const store = inMemoryIdempotencyStore();
    const mw = withIdempotency<{ orderId: string }>({
      store,
      key: ({ input }) => `order:${input.orderId}`,
      ttl: 60_000,
    });
    let nextCalls = 0;
    const next = async () => {
      nextCalls += 1;
      return makeResult(`m${nextCalls}`);
    };
    await mw({
      input: { orderId: '1' },
      ctx: {},
      route: 'welcome',
      messageId: 'test-msg',
      args: { to: 'x@y.com', input: { orderId: '1' } },
      next,
    });
    await mw({
      input: { orderId: '1' },
      ctx: {},
      route: 'welcome',
      messageId: 'test-msg',
      args: { to: 'x@y.com', input: { orderId: '1' } },
      next,
    });
    await mw({
      input: { orderId: '2' },
      ctx: {},
      route: 'welcome',
      messageId: 'test-msg',
      args: { to: 'x@y.com', input: { orderId: '2' } },
      next,
    });
    expect(nextCalls).toBe(2);
  });
});
