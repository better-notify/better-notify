import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { multiTransport } from './multi.js';
import { NotifyRpcError } from '@betternotify/core';
import { memoryLogger } from '../lib/test-utils.js';
import type { Transport, TransportResult } from './types.js';
import type { RenderedMessage, SendContext } from '../types.js';

const baseMessage: RenderedMessage = {
  to: [{ email: 'rcpt@example.com' }],
  from: { email: 'sender@example.com' },
  subject: 'hi',
  html: '<p>hi</p>',
  text: 'hi',
  headers: {},
  attachments: [],
  inlineAssets: {},
};

const baseCtx: SendContext = {
  route: 'welcome',
  messageId: 'msg-1',
  attempt: 1,
};

type FakeBehavior = 'ok' | Error | ((attempt: number) => 'ok' | Error);

type FakeTransport = Transport & {
  readonly calls: number;
  reset(): void;
};

const fakeTransport = (name: string, queue: FakeBehavior[]): FakeTransport => {
  let calls = 0;
  const okResult: TransportResult = {
    ok: true,
    data: {
      accepted: ['rcpt@example.com'],
      rejected: [],
      transportMessageId: `${name}-id`,
    },
  };
  return {
    name,
    get calls() {
      return calls;
    },
    reset() {
      calls = 0;
    },
    async send(): Promise<TransportResult> {
      calls += 1;
      const behavior = queue[Math.min(calls - 1, queue.length - 1)] ?? 'ok';
      const decided = typeof behavior === 'function' ? behavior(calls) : behavior;
      if (decided === 'ok') return okResult;
      throw decided;
    },
  };
};

describe('multiTransport — construction', () => {
  it('throws CONFIG error on empty transports', () => {
    expect(() => multiTransport({ strategy: 'failover', transports: [] })).toThrow(NotifyRpcError);
    try {
      multiTransport({ strategy: 'failover', transports: [] });
    } catch (e) {
      expect((e as NotifyRpcError).code).toBe('CONFIG');
    }
  });

  it('throws on maxAttemptsPerTransport < 1', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        maxAttemptsPerTransport: 0,
      }),
    ).toThrow(/maxAttemptsPerTransport/);
  });

  it('throws on invalid backoff (initialMs <= 0)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 0, factor: 2, maxMs: 1000 },
      }),
    ).toThrow(/backoff/);
  });

  it('throws on invalid backoff (factor < 1)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 10, factor: 0.5, maxMs: 1000 },
      }),
    ).toThrow(/backoff/);
  });

  it('throws on invalid backoff (maxMs < initialMs)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 100, factor: 2, maxMs: 50 },
      }),
    ).toThrow(/backoff/);
  });

  it('returns a Transport with name "multi" by default', () => {
    const t = fakeTransport('a', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: t }],
    });
    expect(m.name).toBe('multi');
  });

  it('honors opts.name override', () => {
    const t = fakeTransport('a', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: t }],
      name: 'composite',
    });
    expect(m.name).toBe('composite');
  });
});

describe('multiTransport — failover strategy', () => {
  it('returns transport[0] result when it succeeds; never calls transport[1]', async () => {
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const res = await m.send(baseMessage, baseCtx);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.transportMessageId).toBe('a-id');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it('advances on retriable error and returns next transport result', async () => {
    const a = fakeTransport('a', [new Error('boom')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const res = await m.send(baseMessage, baseCtx);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.transportMessageId).toBe('b-id');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('throws lastErr when all transports fail; calls each once', async () => {
    const errA = new Error('a-fail');
    const errB = new Error('b-fail');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', [errB]);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send(baseMessage, baseCtx)).rejects.toBe(errB);
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('non-retriable on transport[0] still advances to transport[1]', async () => {
    const errA = new Error('fatal');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      isRetriable: () => false,
      logger: log,
    });
    const res = await m.send(baseMessage, baseCtx);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.transportMessageId).toBe('b-id');
    const failed = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(failed?.payload.retriable).toBe(false);
  });

  it('maxAttemptsPerTransport: 3 retries the same transport before advancing', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2'), new Error('3')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 3,
    });
    const res = await m.send(baseMessage, baseCtx);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.transportMessageId).toBe('b-id');
    expect(a.calls).toBe(3);
    expect(b.calls).toBe(1);
  });

  it('skips undefined slots in a sparse transports array', async () => {
    const a = fakeTransport('a', ['ok']);
    const sparse: { transport: typeof a }[] = [];
    sparse[1] = { transport: a };
    const m = multiTransport({ strategy: 'failover', transports: sparse });
    const res = await m.send(baseMessage, baseCtx);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.transportMessageId).toBe('a-id');
    expect(a.calls).toBe(1);
  });
});

describe('multiTransport — round-robin strategy', () => {
  it('counter advances per send() across 4 sends with 2 transports → [2, 2]', async () => {
    const a = fakeTransport('a', ['ok', 'ok', 'ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok', 'ok', 'ok']);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    expect(a.calls).toBe(2);
    expect(b.calls).toBe(2);
  });

  it('round-robin + failover walks forward from rotating start', async () => {
    const a = fakeTransport('a', [new Error('a1'), new Error('a2')]);
    const b = fakeTransport('b', [new Error('b1'), new Error('b2')]);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(a.calls).toBe(2);
    expect(b.calls).toBe(2);
  });

  it('round-robin: when start transport succeeds, others never called', async () => {
    const a = fakeTransport('a', ['ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok']);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });
});

describe('multiTransport — random strategy', () => {
  it('picks the start index from Math.random and runs that transport', async () => {
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const c = fakeTransport('c', ['ok']);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const m = multiTransport({
        strategy: 'random',
        transports: [{ transport: a }, { transport: b }, { transport: c }],
      });
      await m.send(baseMessage, baseCtx);
      expect(c.calls).toBe(1);
      expect(a.calls).toBe(0);
      expect(b.calls).toBe(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('on failure walks forward modulo n from the random start', async () => {
    const a = fakeTransport('a', [new Error('a-fail')]);
    const b = fakeTransport('b', [new Error('b-fail')]);
    const c = fakeTransport('c', ['ok']);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.34);
    try {
      const m = multiTransport({
        strategy: 'random',
        transports: [{ transport: a }, { transport: b }, { transport: c }],
      });
      const res = await m.send(baseMessage, baseCtx);
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.transportMessageId).toBe('c-id');
      expect(b.calls).toBe(1);
      expect(c.calls).toBe(1);
      expect(a.calls).toBe(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not advance the round-robin counter (each send draws fresh)', async () => {
    const a = fakeTransport('a', ['ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok']);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const m = multiTransport({
        strategy: 'random',
        transports: [{ transport: a }, { transport: b }],
      });
      await m.send(baseMessage, baseCtx);
      await m.send(baseMessage, baseCtx);
      expect(a.calls).toBe(2);
      expect(b.calls).toBe(0);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe('multiTransport — backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays follow min(maxMs, initialMs * factor^(attempt-1)) between attempts on the same transport', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2'), new Error('3')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 3,
      backoff: { initialMs: 100, factor: 2, maxMs: 1000 },
    });
    const promise = m.send(baseMessage, baseCtx);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(a.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(200);
    expect(a.calls).toBe(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.calls).toBe(1);
    await expect(promise).resolves.toBeDefined();
  });

  it('delay capped at maxMs', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 2,
      backoff: { initialMs: 1000, factor: 10, maxMs: 1500 },
    });
    const promise = m.send(baseMessage, baseCtx);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(a.calls).toBe(2);
    await promise;
  });

  it('no backoff config + retries → no setTimeout scheduled', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const a = fakeTransport('a', [new Error('1'), new Error('2')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 2,
    });
    await m.send(baseMessage, baseCtx);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});

describe('multiTransport — isRetriable', () => {
  it('custom predicate marks errors retriable=false but still advances', async () => {
    const errA = new Error('skip');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      isRetriable: (err) => (err as Error).message === 'retry',
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    expect(b.calls).toBe(1);
    const rec = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(rec?.payload.retriable).toBe(false);
  });

  it('default predicate treats every error as retriable', async () => {
    const a = fakeTransport('a', [new Error('boom')]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    const rec = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(rec?.payload.retriable).toBe(true);
  });
});

describe('multiTransport — verify()', () => {
  it('all inner verify ok → ok=true with per-inner results', async () => {
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: true, details: 'a-ok' }),
    };
    const b: Transport = {
      name: 'b',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: true }),
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
    expect(res.details).toEqual({
      results: [
        { name: 'a', ok: true, details: 'a-ok' },
        { name: 'b', ok: true },
      ],
    });
  });

  it('any inner ok → composite ok=true', async () => {
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: false, details: 'down' }),
    };
    const b: Transport = {
      name: 'b',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: true }),
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
  });

  it('no inner ok → composite ok=false', async () => {
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: false }),
    };
    const b: Transport = {
      name: 'b',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: false }),
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const res = await m.verify!();
    expect(res.ok).toBe(false);
  });

  it('inner without verify → reported as ok: true', async () => {
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
    expect(res.details).toEqual({ results: [{ name: 'a', ok: true }] });
  });

  it('inner verify throws → captured as ok: false with details=err; composite does not throw', async () => {
    const err = new Error('verify boom');
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => {
        throw err;
      },
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    const res = await m.verify!();
    expect(res.ok).toBe(false);
    expect((res.details as { results: Array<{ details: unknown }> }).results[0]!.details).toBe(err);
  });
});

describe('multiTransport — close()', () => {
  it('calls every inner close in parallel; composite resolves', async () => {
    const closes: string[] = [];
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      close: async () => {
        closes.push('a');
      },
    };
    const b: Transport = {
      name: 'b',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      close: async () => {
        closes.push('b');
      },
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.close!();
    expect(closes.sort()).toEqual(['a', 'b']);
  });

  it('one inner close throws → logged at error, composite still resolves', async () => {
    const err = new Error('close boom');
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      close: async () => {
        throw err;
      },
    };
    const b: Transport = {
      name: 'b',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      close: async () => {},
    };
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      logger: log,
    });
    await expect(m.close!()).resolves.toBeUndefined();
    const rec = log.records.find((r) => r.message === 'multi close failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.transportName).toBe('a');
    expect(rec?.payload.err).toBe(err);
  });

  it('inner without close → skipped silently', async () => {
    const a: Transport = {
      name: 'a',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
    };
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    await expect(m.close!()).resolves.toBeUndefined();
  });
});

describe('multiTransport — logging', () => {
  it('emits multi attempt ok on success', async () => {
    const a = fakeTransport('a', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    const rec = log.records.find((r) => r.message === 'multi attempt ok');
    expect(rec?.level).toBe('debug');
    expect(rec?.payload).toMatchObject({
      transportName: 'a',
      attempt: 1,
      strategy: 'failover',
    });
  });

  it('emits multi exhausted on total failure', async () => {
    const errA = new Error('a-fail');
    const a = fakeTransport('a', [errA]);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
      logger: log,
    });
    await expect(m.send(baseMessage, baseCtx)).rejects.toBe(errA);
    const rec = log.records.find((r) => r.message === 'multi exhausted');
    expect(rec?.level).toBe('error');
    expect(rec?.payload).toMatchObject({ attempts: 1 });
    expect(rec?.payload.lastErr).toBe(errA);
  });

  it('logger bindings include component=multi-transport and the configured name', async () => {
    const a = fakeTransport('a', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
      name: 'composite',
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    expect(log.records[0]?.bindings).toMatchObject({
      component: 'multi-transport',
      name: 'composite',
    });
  });

  it('defaults to consoleLogger when opts.logger is unset (warn record reaches console.warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = fakeTransport('a', [new Error('boom')]);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
