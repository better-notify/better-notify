import { describe, it, expect } from 'vitest';
import type { Middleware } from './types.js';
import { withTagInject } from './with-tag-inject.js';

const noopNext = (_override?: unknown) =>
  Promise.resolve({
    messageId: 'm',
    accepted: ['x@y.com'],
    rejected: [],
    envelope: { from: 'a@b.com', to: ['x@y.com'] },
    timing: { renderMs: 0, sendMs: 0 },
  });

describe('withTagInject', () => {
  it('exposes injected tags via ctx', async () => {
    let observed: unknown;
    const mw = withTagInject({ tags: { env: 'prod', region: 'eu' } });
    const downstream: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };
    const result = await mw({
      input: {},
      ctx: {},
      route: 'r',
      messageId: 'test-msg',
      args: { to: 'x@y.com', input: {} },
      next: ((newCtx?: object) =>
        downstream({
          input: {},
          ctx: { ...newCtx },
          route: 'r',
      messageId: 'test-msg',
          args: { to: 'x@y.com', input: {} },
          next: noopNext as never,
        })) as never,
    });
    expect(observed).toMatchObject({
      tagsToInject: { env: 'prod', region: 'eu' },
    });
    expect(result.accepted).toEqual(['x@y.com']);
  });
});
