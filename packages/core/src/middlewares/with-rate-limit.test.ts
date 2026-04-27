import { describe, it, expect } from 'vitest';
import { inMemoryRateLimitStore } from '../stores/in-memory-rate-limit-store.js';
import { withRateLimit } from './with-rate-limit.js';
import { NotifyRpcRateLimitedError } from '../errors.js';
import type { Middleware } from './types.js';
import type { RawSendArgs, SendResult } from '../types.js';

const okResult: SendResult = {
  messageId: 'm',
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
};

const callMw = (mw: Middleware, args: RawSendArgs = { to: 'x@y.com', input: {} }) =>
  mw({ input: {}, ctx: {}, route: 'welcome', messageId: 'test-msg', args, next: async () => okResult });

describe('withRateLimit', () => {
  it('passes through under the limit', async () => {
    const store = inMemoryRateLimitStore();
    const mw = withRateLimit({ store, key: 'k', max: 3, window: 1000 });
    await expect(callMw(mw)).resolves.toMatchObject({ messageId: 'm' });
    await expect(callMw(mw)).resolves.toMatchObject({ messageId: 'm' });
    await expect(callMw(mw)).resolves.toMatchObject({ messageId: 'm' });
  });

  it('throws NotifyRpcRateLimitedError when count exceeds max', async () => {
    const store = inMemoryRateLimitStore();
    const mw = withRateLimit({ store, key: 'k', max: 2, window: 60_000 });
    await callMw(mw);
    await callMw(mw);
    await expect(callMw(mw)).rejects.toBeInstanceOf(NotifyRpcRateLimitedError);
  });

  it('error carries key + retryAfterMs', async () => {
    const store = inMemoryRateLimitStore();
    const mw = withRateLimit({ store, key: 'tenant-1', max: 1, window: 60_000 });
    await callMw(mw);
    const err = await callMw(mw).catch((e) => e);
    expect(err).toBeInstanceOf(NotifyRpcRateLimitedError);
    expect((err as NotifyRpcRateLimitedError).key).toBe('tenant-1');
    expect((err as NotifyRpcRateLimitedError).retryAfterMs).toBeGreaterThan(0);
  });

  it('supports a function key derived from args', async () => {
    const store = inMemoryRateLimitStore();
    const mw = withRateLimit({
      store,
      key: ({ args }) => (typeof args.to === 'string' ? args.to : 'multi'),
      max: 1,
      window: 60_000,
    });
    await callMw(mw, { to: 'a@x.com', input: {} });
    await expect(callMw(mw, { to: 'a@x.com', input: {} })).rejects.toBeInstanceOf(
      NotifyRpcRateLimitedError,
    );
    await expect(callMw(mw, { to: 'b@x.com', input: {} })).resolves.toMatchObject({
      messageId: 'm',
    });
  });

  it('supports sliding algorithm', async () => {
    const store = inMemoryRateLimitStore();
    const mw = withRateLimit({
      store,
      key: 'k',
      max: 2,
      window: 60_000,
      algorithm: 'sliding',
    });
    await callMw(mw);
    await callMw(mw);
    await expect(callMw(mw)).rejects.toBeInstanceOf(NotifyRpcRateLimitedError);
  });
});
