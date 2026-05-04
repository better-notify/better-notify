import { describe, expect, it, vi } from 'vitest';
import { createTransport } from './create-transport.js';
import { multiTransport } from './multi.js';
import { createMockTransport } from './mock-transport.js';
import { mapTransport } from './map-transport.js';
import type { SendContext, Transport, TransportResult } from '../transport.js';
import { NotifyRpcError } from '../errors.js';

type R = { body: string };
type D = { id: string };

const baseCtx: SendContext = { route: 'r', messageId: 'm', attempt: 1 };

describe('createTransport', () => {
  it('returns a Transport with name + send', async () => {
    const t = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: '1' } }),
    });
    expect(t.name).toBe('a');
    const r = await t.send({ body: 'hi' }, baseCtx);
    expect(r).toEqual({ ok: true, data: { id: '1' } });
  });

  it('default verify resolves to { ok: true }', async () => {
    const t = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: '1' } }),
    });
    expect(await t.verify!()).toEqual({ ok: true });
  });

  it('default close resolves to undefined', async () => {
    const t = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: '1' } }),
    });
    await expect(t.close!()).resolves.toBeUndefined();
  });

  it('honors custom verify and close', async () => {
    let closed = false;
    const t = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: '1' } }),
      verify: async () => ({ ok: false, details: 'down' }),
      close: async () => {
        closed = true;
      },
    });
    expect(await t.verify!()).toEqual({ ok: false, details: 'down' });
    await t.close!();
    expect(closed).toBe(true);
  });
});

describe('createMockTransport', () => {
  it('records sends and returns ok with default empty data', async () => {
    const t = createMockTransport<R>();
    const result = await t.send({ body: 'hi' }, baseCtx);
    expect(result).toEqual({ ok: true, data: {} });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatchObject({ rendered: { body: 'hi' }, ctx: baseCtx });
  });

  it('uses configured reply for data', async () => {
    const t = createMockTransport<R, D>({
      reply: (rendered, ctx) => ({ id: `${ctx.route}:${rendered.body}` }),
    });
    const result = await t.send({ body: 'a' }, baseCtx);
    expect(result).toEqual({ ok: true, data: { id: 'r:a' } });
  });

  it('async reply works', async () => {
    const t = createMockTransport<R, D>({
      reply: async () => ({ id: 'async' }),
    });
    expect(await t.send({ body: 'a' }, baseCtx)).toEqual({ ok: true, data: { id: 'async' } });
  });

  it('reset clears recorded sends', async () => {
    const t = createMockTransport<R>();
    await t.send({ body: 'x' }, baseCtx);
    expect(t.sent).toHaveLength(1);
    t.reset();
    expect(t.sent).toHaveLength(0);
  });

  it('uses provided name', () => {
    const t = createMockTransport<R>({ name: 'my-mock' });
    expect(t.name).toBe('my-mock');
  });
});

const fakeTransport = (
  name: string,
  behaviors: Array<'ok' | Error | TransportResult<D>>,
): Transport<R, D> & { calls: number } => {
  let calls = 0;
  return {
    name,
    get calls() {
      return calls;
    },
    async send() {
      const i = Math.min(calls, behaviors.length - 1);
      calls += 1;
      const b = behaviors[i] ?? 'ok';
      if (b === 'ok') return { ok: true, data: { id: `${name}-${calls}` } };
      if (b instanceof Error) throw b;
      return b;
    },
  } as Transport<R, D> & { calls: number };
};

describe('multiTransport — construction', () => {
  it('throws CONFIG on empty transports', () => {
    expect(() => multiTransport<R, D>({ strategy: 'failover', transports: [] })).toThrow(
      NotifyRpcError,
    );
  });

  it('throws CONFIG on invalid maxAttemptsPerTransport', () => {
    expect(() =>
      multiTransport<R, D>({
        strategy: 'failover',
        transports: [{ transport: fakeTransport('a', ['ok']) }],
        maxAttemptsPerTransport: 0,
      }),
    ).toThrow(/maxAttemptsPerTransport/);
  });

  it('throws CONFIG on invalid backoff', () => {
    expect(() =>
      multiTransport<R, D>({
        strategy: 'failover',
        transports: [{ transport: fakeTransport('a', ['ok']) }],
        backoff: { initialMs: 0, factor: 1, maxMs: 100 },
      }),
    ).toThrow(/backoff/);
  });
});

describe('multiTransport — send', () => {
  it('failover returns first ok', async () => {
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    expect(r).toMatchObject({ ok: true });
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it('failover advances on thrown error', async () => {
    const a = fakeTransport('a', [new Error('boom')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    expect(r).toMatchObject({ ok: true, data: { id: 'b-1' } });
  });

  it('failover advances on { ok: false } return', async () => {
    const a = fakeTransport('a', [{ ok: false, error: new Error('soft fail') }]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    expect(r).toMatchObject({ ok: true, data: { id: 'b-1' } });
  });

  it('throws lastErr when all transports fail', async () => {
    const a = fakeTransport('a', [new Error('a-fail')]);
    const b = fakeTransport('b', [new Error('b-fail')]);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('b-fail');
  });

  it('round-robin alternates start index', async () => {
    const a = fakeTransport('a', ['ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok']);
    const m = multiTransport<R, D>({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    const r1 = await m.send({ body: 'x' }, baseCtx);
    const r2 = await m.send({ body: 'x' }, baseCtx);
    if (!r1.ok || !r2.ok) throw new Error('expected ok');
    expect([r1.data.id, r2.data.id].sort()).toEqual(['a-1', 'b-1']);
  });

  it('skips sparse sequential entries', async () => {
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const transports = [{ transport: a }, { transport: b }];
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports,
    });
    delete transports[0];

    const r = await m.send({ body: 'x' }, baseCtx);

    expect(r).toMatchObject({ ok: true, data: { id: 'b-1' } });
    expect(a.calls).toBe(0);
  });

  it('random uses Math.random', async () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport<R, D>({
      strategy: 'random',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('b-1');
    spy.mockRestore();
  });

  it('retries up to maxAttemptsPerTransport when retriable', async () => {
    const a = fakeTransport('a', [new Error('e1'), new Error('e2'), 'ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
      maxAttemptsPerTransport: 3,
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    expect(r).toMatchObject({ ok: true });
    expect(a.calls).toBe(3);
  });

  it('advances immediately on non-retriable error', async () => {
    const a = fakeTransport('a', [new Error('e1'), new Error('e2'), 'ok']);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 3,
      isRetriable: () => false,
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    expect(r).toMatchObject({ ok: true, data: { id: 'b-1' } });
    expect(a.calls).toBe(1);
  });

  it('honors backoff between retries', async () => {
    const a = fakeTransport('a', [new Error('e1'), 'ok']);
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
      maxAttemptsPerTransport: 2,
      backoff: { initialMs: 5, factor: 2, maxMs: 20 },
    });
    const start = Date.now();
    await m.send({ body: 'x' }, baseCtx);
    expect(Date.now() - start).toBeGreaterThanOrEqual(4);
  });
});

describe('multiTransport — verify and close', () => {
  it('verify reports per-inner results', async () => {
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
      verify: async () => ({ ok: true }),
    };
    const b: Transport<R, D> = {
      name: 'b',
      send: async () => ({ ok: true, data: { id: 'b' } }),
      verify: async () => ({ ok: false, details: 'down' }),
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.verify!();
    expect(r.ok).toBe(true);
  });

  it('verify catches inner verify errors', async () => {
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
      verify: async () => {
        throw new Error('boom');
      },
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    const r = await m.verify!();
    expect(r.ok).toBe(false);
  });

  it('verify treats inner without verify as ok', async () => {
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    const r = await m.verify!();
    expect(r.ok).toBe(true);
  });

  it('close calls each inner close', async () => {
    let aClosed = false;
    let bClosed = false;
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
      close: async () => {
        aClosed = true;
      },
    };
    const b: Transport<R, D> = {
      name: 'b',
      send: async () => ({ ok: true, data: { id: 'b' } }),
      close: async () => {
        bClosed = true;
      },
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.close!();
    expect(aClosed).toBe(true);
    expect(bClosed).toBe(true);
  });

  it('close swallows inner close errors', async () => {
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
      close: async () => {
        throw new Error('boom');
      },
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
    });
    await expect(m.close!()).resolves.toBeUndefined();
  });

  it('close ignores inners without close handlers', async () => {
    const a: Transport<R, D> = {
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
    };
    const m = multiTransport<R, D>({
      strategy: 'failover',
      transports: [{ transport: a }],
    });

    await expect(m.close!()).resolves.toBeUndefined();
  });
});

describe('multiTransport — race', () => {
  it('returns first successful result; ignores slower ones', async () => {
    const fast = createTransport<R, D>({
      name: 'fast',
      send: async () => ({ ok: true, data: { id: 'fast' } }),
    });
    const slow = createTransport<R, D>({
      name: 'slow',
      send: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { ok: true, data: { id: 'slow' } };
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'race',
      transports: [{ transport: slow }, { transport: fast }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('fast');
  });

  it('skips failures and returns the first success', async () => {
    const broken = createTransport<R, D>({
      name: 'broken',
      send: async () => {
        throw new Error('boom');
      },
    });
    const good = createTransport<R, D>({
      name: 'good',
      send: async () => ({ ok: true, data: { id: 'good' } }),
    });
    const m = multiTransport<R, D>({
      strategy: 'race',
      transports: [{ transport: broken }, { transport: good }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('good');
  });

  it('throws when all transports fail', async () => {
    const a = createTransport<R, D>({
      name: 'a',
      send: async () => {
        throw new Error('a-fail');
      },
    });
    const b = createTransport<R, D>({
      name: 'b',
      send: async () => {
        throw new Error('b-fail');
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'race',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow(/a-fail|b-fail/);
  });

  it('throws the AggregateError when race entries are removed after construction', async () => {
    const transports = [{ transport: fakeTransport('a', ['ok']) }];
    const m = multiTransport<R, D>({
      strategy: 'race',
      transports,
    });
    transports.pop();

    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toBeInstanceOf(AggregateError);
  });

  it('handles a non-AggregateError Promise.any rejection defensively', async () => {
    const anySpy = vi.spyOn(Promise, 'any').mockRejectedValueOnce(new Error('plain any failure'));
    const m = multiTransport<R, D>({
      strategy: 'race',
      transports: [{ transport: fakeTransport('a', ['ok']) }],
    });

    try {
      await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('plain any failure');
    } finally {
      anySpy.mockRestore();
    }
  });
});

describe('multiTransport — parallel', () => {
  it('succeeds when all branches succeed; returns first transport data', async () => {
    const calls: string[] = [];
    const a = createTransport<R, D>({
      name: 'a',
      send: async () => {
        calls.push('a');
        return { ok: true, data: { id: 'a' } };
      },
    });
    const b = createTransport<R, D>({
      name: 'b',
      send: async () => {
        calls.push('b');
        return { ok: true, data: { id: 'b' } };
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'parallel',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('a');
    expect(calls.sort()).toEqual(['a', 'b']);
  });

  it('throws when any branch fails (even if others succeed)', async () => {
    const a = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
    });
    const b = createTransport<R, D>({
      name: 'b',
      send: async () => {
        throw new Error('b-fail');
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'parallel',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('b-fail');
  });

  it('treats { ok: false } returns the same as throws', async () => {
    const a = createTransport<R, D>({
      name: 'a',
      send: async () => ({ ok: true, data: { id: 'a' } }),
    });
    const b = createTransport<R, D>({
      name: 'b',
      send: async () => ({ ok: false, error: new Error('soft fail') }),
    });
    const m = multiTransport<R, D>({
      strategy: 'parallel',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('soft fail');
  });

  it('throws CONFIG if the transport list is emptied after construction', async () => {
    const transports = [{ transport: fakeTransport('a', ['ok']) }];
    const m = multiTransport<R, D>({
      strategy: 'parallel',
      transports,
    });
    transports.pop();

    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toMatchObject({
      code: 'CONFIG',
      message: 'parallel requires at least one transport',
    });
  });

  it('handles sparse allSettled results defensively', async () => {
    const allSettledSpy = vi
      .spyOn(Promise, 'allSettled')
      .mockResolvedValueOnce([
        undefined,
        { status: 'rejected', reason: new Error('extra fail') },
      ] as never);
    const m = multiTransport<R, D>({
      strategy: 'parallel',
      transports: [{ transport: fakeTransport('a', ['ok']) }],
    });

    try {
      await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('extra fail');
    } finally {
      allSettledSpy.mockRestore();
    }
  });
});

describe('multiTransport — mirrored', () => {
  it('returns primary result; mirrors fire-and-forget', async () => {
    const calls: string[] = [];
    const primary = createTransport<R, D>({
      name: 'primary',
      send: async () => {
        calls.push('primary');
        return { ok: true, data: { id: 'primary' } };
      },
    });
    let mirrorResolved = false;
    const mirror = createTransport<R, D>({
      name: 'mirror',
      send: async () => {
        await new Promise((r) => setTimeout(r, 20));
        calls.push('mirror');
        mirrorResolved = true;
        return { ok: true, data: { id: 'mirror' } };
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'mirrored',
      transports: [{ transport: primary }, { transport: mirror }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('primary');
    expect(calls).toEqual(['primary']); // mirror still pending
    expect(mirrorResolved).toBe(false);
    await new Promise((res) => setTimeout(res, 40));
    expect(mirrorResolved).toBe(true);
  });

  it('mirror failure does not affect primary result', async () => {
    const primary = createTransport<R, D>({
      name: 'primary',
      send: async () => ({ ok: true, data: { id: 'primary' } }),
    });
    const mirror = createTransport<R, D>({
      name: 'mirror',
      send: async () => {
        throw new Error('mirror boom');
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'mirrored',
      transports: [{ transport: primary }, { transport: mirror }],
    });
    const r = await m.send({ body: 'x' }, baseCtx);
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.id).toBe('primary');
    await new Promise((res) => setTimeout(res, 10));
  });

  it('primary failure throws, mirrors never run', async () => {
    let mirrorRan = false;
    const primary = createTransport<R, D>({
      name: 'primary',
      send: async () => {
        throw new Error('primary boom');
      },
    });
    const mirror = createTransport<R, D>({
      name: 'mirror',
      send: async () => {
        mirrorRan = true;
        return { ok: true, data: { id: 'mirror' } };
      },
    });
    const m = multiTransport<R, D>({
      strategy: 'mirrored',
      transports: [{ transport: primary }, { transport: mirror }],
    });
    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toThrow('primary boom');
    expect(mirrorRan).toBe(false);
  });

  it('throws CONFIG if the primary transport is removed after construction', async () => {
    const transports = [{ transport: fakeTransport('primary', ['ok']) }];
    const m = multiTransport<R, D>({
      strategy: 'mirrored',
      transports,
    });
    transports.pop();

    await expect(m.send({ body: 'x' }, baseCtx)).rejects.toMatchObject({
      code: 'CONFIG',
      message: 'mirrored requires at least one transport',
    });
  });

  it('skips sparse mirror entries', async () => {
    const primary = fakeTransport('primary', ['ok']);
    const mirror = fakeTransport('mirror', ['ok']);
    const transports = [{ transport: primary }, { transport: mirror }];
    const m = multiTransport<R, D>({
      strategy: 'mirrored',
      transports,
    });
    delete transports[1];

    const r = await m.send({ body: 'x' }, baseCtx);

    expect(r).toMatchObject({ ok: true, data: { id: 'primary-1' } });
    expect(mirror.calls).toBe(0);
  });
});

describe('mapTransport', () => {
  it('rewrites the rendered message before delegating', async () => {
    let captured: R | undefined;
    const inner = createTransport<R, D>({
      name: 'inner',
      send: async (rendered) => {
        captured = rendered;
        return { ok: true, data: { id: 'x' } };
      },
    });
    const wrapped = mapTransport<R, D>(inner, (msg) => ({ ...msg, body: `[wrapped] ${msg.body}` }));
    await wrapped.send({ body: 'hi' }, baseCtx);
    expect(captured?.body).toBe('[wrapped] hi');
  });

  it('preserves name, verify, and close from the inner transport', async () => {
    let closed = false;
    const inner: Transport<R, D> = {
      name: 'inner',
      send: async () => ({ ok: true, data: { id: 'x' } }),
      verify: async () => ({ ok: true, details: 'inner-detail' }),
      close: async () => {
        closed = true;
      },
    };
    const wrapped = mapTransport<R, D>(inner, (m) => m);
    expect(wrapped.name).toBe('inner');
    expect(await wrapped.verify!()).toEqual({ ok: true, details: 'inner-detail' });
    await wrapped.close!();
    expect(closed).toBe(true);
  });

  it('supports async rewrite functions', async () => {
    let captured: R | undefined;
    const inner = createTransport<R, D>({
      name: 'inner',
      send: async (rendered) => {
        captured = rendered;
        return { ok: true, data: { id: 'x' } };
      },
    });
    const wrapped = mapTransport<R, D>(inner, async (msg) => ({
      ...msg,
      body: msg.body.toUpperCase(),
    }));
    await wrapped.send({ body: 'hi' }, baseCtx);
    expect(captured?.body).toBe('HI');
  });
});
