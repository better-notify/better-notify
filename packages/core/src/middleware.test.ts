import { describe, it, expect } from 'vitest';
import {
  dryRunMw,
  tagInjectMw,
  eventLoggerMw,
  suppressionListMw,
  rateLimitMw,
  idempotencyMw,
  tracingMw,
} from './middleware.js';
import type { Middleware } from './middleware.js';

const noopNext = (_override?: unknown) =>
  Promise.resolve({
    messageId: 'm',
    accepted: ['x@y.com'],
    rejected: [],
    envelope: { from: 'a@b.com', to: ['x@y.com'] },
    timing: { renderMs: 0, sendMs: 0 },
  });

describe('dryRunMw', () => {
  it('short-circuits without calling next', async () => {
    const mw = dryRunMw();
    let called = false;
    const r = await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      next: (() => {
        called = true;
        return noopNext();
      }) as never,
    });
    expect(called).toBe(false);
    expect(r.messageId).toBe('dry-run');
    expect(r.accepted).toEqual([]);
  });
});

describe('tagInjectMw', () => {
  it('exposes injected tags via ctx', async () => {
    let observed: unknown;
    const mw = tagInjectMw({ tags: { env: 'prod', region: 'eu' } });
    const downstream: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };
    const result = await mw({
      input: {},
      ctx: {},
      route: 'r',
      next: ((newCtx?: object) =>
        downstream({
          input: {},
          ctx: { ...(newCtx ?? {}) },
          route: 'r',
          next: noopNext as never,
        })) as never,
    });
    expect(observed).toMatchObject({ tagsToInject: { env: 'prod', region: 'eu' } });
    expect(result.accepted).toEqual(['x@y.com']);
  });
});

describe('not-yet-implemented middleware stubs', () => {
  it.each([
    ['eventLoggerMw', () => eventLoggerMw({ storage: {} })],
    ['suppressionListMw', () => suppressionListMw({ list: {} })],
    ['rateLimitMw', () => rateLimitMw({ key: 'x', max: 1, window: '1h' })],
    ['idempotencyMw', () => idempotencyMw({ store: {} })],
    ['tracingMw', () => tracingMw()],
  ])('%s throws EmailRpcNotImplementedError', (_name, factory) => {
    expect(factory).toThrow(/not implemented/i);
  });
});
