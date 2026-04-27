import { describe, it, expect } from 'vitest';
import { withTracing } from './with-tracing.js';
import { inMemoryTracer } from '../tracers/in-memory-tracer.js';
import type { Middleware, SendArgsLike } from './types.js';

type SendResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  envelope: { from: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

const okResult: SendResult = {
  messageId: 'm-internal',
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
};

const callMw = (
  mw: Middleware,
  next: () => Promise<SendResult>,
  args: SendArgsLike = { to: 'x@y.com', input: {} },
) =>
  mw({
    input: {},
    ctx: {},
    route: 'welcome',
    messageId: 'msg-1',
    args,
    next,
  });

describe('withTracing', () => {
  it('records a span with default name and ok status on success', async () => {
    const tracer = inMemoryTracer();
    const mw = withTracing({ tracer });
    await callMw(mw, async () => okResult);
    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]).toMatchObject({
      name: 'betternotify.send.welcome',
      attributes: {
        'betternotify.route': 'welcome',
        'betternotify.message_id': 'msg-1',
      },
      status: { code: 'ok' },
      ended: true,
    });
  });

  it('records exception and error status on failure, then re-throws', async () => {
    const tracer = inMemoryTracer();
    const mw = withTracing({ tracer });
    const err = new Error('boom');
    await expect(callMw(mw, async () => Promise.reject(err))).rejects.toThrow('boom');
    expect(tracer.spans[0]?.exceptions).toEqual([err]);
    expect(tracer.spans[0]?.status).toEqual({ code: 'error', message: 'boom' });
  });

  it('supports a custom name function', async () => {
    const tracer = inMemoryTracer();
    const mw = withTracing({
      tracer,
      name: ({ route, messageId }) => `mail.${route}.${messageId}`,
    });
    await callMw(mw, async () => okResult);
    expect(tracer.spans[0]?.name).toBe('mail.welcome.msg-1');
  });

  it('supports a static name string', async () => {
    const tracer = inMemoryTracer();
    const mw = withTracing({ tracer, name: 'fixed-span' });
    await callMw(mw, async () => okResult);
    expect(tracer.spans[0]?.name).toBe('fixed-span');
  });
});
