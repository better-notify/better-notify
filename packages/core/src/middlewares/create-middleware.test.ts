import { describe, it, expect } from 'vitest';
import { createMiddleware } from './create-middleware.js';

const noopNext = () =>
  Promise.resolve({
    messageId: 'm',
    accepted: ['x@y.com'],
    rejected: [],
    envelope: { from: 'a@b.com', to: ['x@y.com'] },
    timing: { renderMs: 0, sendMs: 0 },
  });

describe('createMiddleware', () => {
  it('returns a middleware that calls next', async () => {
    const mw = createMiddleware(async ({ next }) => next());
    const result = await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      messageId: 'test',
      args: { to: 'x@y.com', input: {} },
      next: noopNext as never,
    });
    expect(result).toEqual(await noopNext());
  });

  it('can short-circuit without calling next', async () => {
    const mw = createMiddleware(async () => ({
      messageId: 'skipped',
      timing: { renderMs: 0, sendMs: 0 },
    }));
    let called = false;
    const result = (await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      messageId: 'test',
      args: { to: 'x@y.com', input: {} },
      next: (() => {
        called = true;
        return noopNext();
      }) as never,
    })) as { messageId: string };
    expect(called).toBe(false);
    expect(result.messageId).toBe('skipped');
  });

  it('passes context mutations through next', async () => {
    const mw = createMiddleware(async ({ next }) => next({ tenantId: 'acme' }));
    let receivedCtx: unknown;
    await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      messageId: 'test',
      args: { to: 'x@y.com', input: {} },
      next: ((newCtx?: unknown) => {
        receivedCtx = newCtx;
        return noopNext();
      }) as never,
    });
    expect(receivedCtx).toEqual({ tenantId: 'acme' });
  });

  it('preserves typed input', async () => {
    type OrderInput = { orderId: string };
    const mw = createMiddleware<OrderInput>(async ({ input, next }) => {
      expect(input.orderId).toBe('123');
      return next();
    });
    await mw({
      input: { orderId: '123' },
      ctx: {},
      route: 'order',
      messageId: 'test',
      args: { to: 'x@y.com', input: { orderId: '123' } },
      next: noopNext as never,
    });
  });
});
