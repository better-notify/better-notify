import { describe, it, expect, vi } from 'vitest';
import { inMemorySuppressionList } from '@betternotify/core';
import type { Middleware, LoggerLike } from '@betternotify/core';
import { withSuppressionList } from './with-suppression-list.js';
import type { RawSendArgs } from '../types.js';

type SendResultLike = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  envelope: { from: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

const okResult: SendResultLike = {
  messageId: 'm',
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
};

const callMw = (mw: Middleware, args: RawSendArgs, route = 'welcome') => {
  let nextCalled = false;
  const result = mw({
    input: {},
    ctx: {},
    route,
    messageId: 'test-msg',
    args: args as unknown as { input: unknown; [k: string]: unknown },
    next: async () => {
      nextCalled = true;
      return okResult;
    },
  }) as Promise<SendResultLike>;
  return { result, nextCalled: () => nextCalled };
};

const makeLogger = (): LoggerLike & { calls: Array<{ msg: string; payload?: object }> } => {
  const calls: Array<{ msg: string; payload?: object }> = [];
  const fn =
    (level: string) =>
    (msg: string, payload?: object): void => {
      calls.push({ msg: `${level}:${msg}`, payload });
    };
  const logger: LoggerLike & { calls: typeof calls } = {
    calls,
    debug: fn('debug'),
    info: fn('info'),
    warn: fn('warn'),
    error: fn('error'),
    child: () => logger,
  };
  return logger;
};

describe('withSuppressionList', () => {
  it('passes through when no recipients are suppressed', async () => {
    const list = inMemorySuppressionList();
    const mw = withSuppressionList({ list });
    const { result, nextCalled } = callMw(mw, { to: 'fresh@x.com', input: {} });
    expect((await result).messageId).toBe('m');
    expect(nextCalled()).toBe(true);
  });

  it('short-circuits when any recipient is suppressed', async () => {
    const list = inMemorySuppressionList();
    await list.set('blocked@x.com', { reason: 'unsubscribe', createdAt: new Date() });
    const logger = makeLogger();
    const mw = withSuppressionList({ list, logger });
    const { result, nextCalled } = callMw(mw, {
      to: ['fresh@x.com', 'blocked@x.com'],
      input: {},
    });
    const r = await result;
    expect(r.messageId).toBe('suppressed');
    expect(r.rejected).toContain('blocked@x.com');
    expect(nextCalled()).toBe(false);
    expect(logger.calls.some((c) => c.msg === 'warn:email suppressed')).toBe(true);
  });

  it('checks cc and bcc by default', async () => {
    const list = inMemorySuppressionList();
    await list.set('bcc@x.com', { reason: 'manual', createdAt: new Date() });
    const mw = withSuppressionList({ list });
    const { nextCalled } = callMw(mw, {
      to: 'ok@x.com',
      bcc: 'bcc@x.com',
      input: {},
    });
    expect(nextCalled()).toBe(false);
  });

  it('honors fields option to skip cc/bcc', async () => {
    const list = inMemorySuppressionList();
    await list.set('bcc@x.com', { reason: 'manual', createdAt: new Date() });
    const mw = withSuppressionList({ list, fields: ['to'] });
    const { result, nextCalled } = callMw(mw, {
      to: 'ok@x.com',
      bcc: 'bcc@x.com',
      input: {},
    });
    expect((await result).messageId).toBe('m');
    expect(nextCalled()).toBe(true);
  });

  it('falls back to console.warn when no logger supplied', async () => {
    const list = inMemorySuppressionList();
    await list.set('blocked@x.com', { reason: 'bounce', createdAt: new Date() });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const mw = withSuppressionList({ list });
      await callMw(mw, { to: 'blocked@x.com', input: {} }).result;
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
