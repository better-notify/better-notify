import { describe, it, expect } from 'vitest';
import { withEventLogger } from './with-event-logger.js';
import { inMemoryEventSink } from '../sinks/in-memory-event-sink.js';
import type { Middleware } from './types.js';
import type { RawSendArgs, SendResult } from '../types.js';

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
  args: RawSendArgs = { to: 'x@y.com', input: {} },
) =>
  mw({
    input: {},
    ctx: {},
    route: 'welcome',
    messageId: 'msg-1',
    args,
    next,
  });

describe('withEventLogger', () => {
  it('writes a success event with the result', async () => {
    const sink = inMemoryEventSink();
    const mw = withEventLogger({ sink });
    const result = await callMw(mw, async () => okResult);
    expect(result).toBe(okResult);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      route: 'welcome',
      messageId: 'msg-1',
      status: 'success',
      result: okResult,
    });
  });

  it('writes an error event and re-throws', async () => {
    const sink = inMemoryEventSink();
    const mw = withEventLogger({ sink });
    const err = Object.assign(new Error('boom'), { code: 'PROVIDER' });
    await expect(callMw(mw, async () => Promise.reject(err))).rejects.toThrow('boom');
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      status: 'error',
      error: { name: 'Error', message: 'boom', code: 'PROVIDER' },
    });
  });

  it('records duration', async () => {
    const sink = inMemoryEventSink();
    const mw = withEventLogger({ sink });
    await callMw(
      mw,
      () => new Promise((resolve) => setTimeout(() => resolve(okResult), 5)),
    );
    expect(sink.events[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
