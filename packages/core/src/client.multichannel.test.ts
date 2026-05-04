import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createClient } from './client.js';
import { NotifyRpcError } from './errors.js';
import type { AnyChannel, AnyCatalog, ChannelDefinition } from './index.js';

type TestRendered = { body: string; to: string };

type TestArgs = { to: string; input: { name: string } };

type TestTransportData = {
  transportMessageId: string;
  accepted: string[];
  rejected: string[];
};

type TestTransport = {
  name: string;
  sent: Array<{ rendered: TestRendered; route: string }>;
  send: (
    rendered: TestRendered,
    ctx: { route: string; messageId: string; attempt: number },
  ) => Promise<{ ok: true; data: TestTransportData }>;
};

const createTestTransport = (): TestTransport => {
  const sent: Array<{ rendered: TestRendered; route: string }> = [];
  return {
    name: 'test',
    sent,
    send: async (rendered, ctx) => {
      sent.push({ rendered, route: ctx.route });
      return {
        ok: true,
        data: {
          transportMessageId: `test-${ctx.messageId}`,
          accepted: [rendered.to],
          rejected: [],
        },
      };
    },
  };
};

const testChannel = () => {
  const channel = {
    name: 'test',
    createBuilder: () => ({}),
    finalize: (state: unknown, _id: string) => state as ChannelDefinition<TestArgs, TestRendered>,
    validateArgs: (args: unknown): TestArgs => {
      const a = args as Record<string, unknown>;
      if (!a.to || typeof a.to !== 'string') throw new Error('to required');
      return a as TestArgs;
    },
    render: async (
      def: ChannelDefinition<TestArgs, TestRendered>,
      args: TestArgs,
    ): Promise<TestRendered> => {
      const runtime = (
        def as ChannelDefinition<TestArgs, TestRendered> & {
          runtime: { template: (input: { name: string }) => string };
        }
      ).runtime;
      return { body: runtime.template(args.input), to: args.to };
    },
    _transport: undefined as never,
  };
  return channel as unknown as AnyChannel;
};

const buildTestCatalog = (): AnyCatalog => {
  const schema = z.object({ name: z.string() });
  const def: ChannelDefinition<TestArgs, TestRendered> = {
    id: 'ping',
    channel: 'test',
    schema,
    middleware: [],
    runtime: {
      template: (input: { name: string }) => `Hello ${input.name}`,
    },
    _args: undefined as never,
    _rendered: undefined as never,
  };
  return {
    _brand: 'Catalog' as const,
    _ctx: undefined as never,
    definitions: { ping: def },
    nested: { ping: def as unknown as Record<string, unknown> },
    routes: ['ping'],
  };
};

describe('createClient multi-channel', () => {
  it('dispatches non-email route to channel.render and channel transport on .send', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: {
        send: (a: TestArgs) => Promise<{ messageId: string; data: TestTransportData }>;
      };
    };

    const result = await mail.ping.send({ to: 'alice@x.com', input: { name: 'Alice' } });
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.rendered.body).toBe('Hello Alice');
    expect(transport.sent[0]?.rendered.to).toBe('alice@x.com');
    expect(transport.sent[0]?.route).toBe('ping');
    expect(result.data.transportMessageId).toBe(`test-${result.messageId}`);
  });

  it('batches non-email routes', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: {
        batch: (entries: TestArgs[]) => Promise<{ okCount: number; errorCount: number }>;
      };
    };

    const result = await mail.ping.batch([
      { to: 'a@x.com', input: { name: 'A' } },
      { to: 'b@x.com', input: { name: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(transport.sent).toHaveLength(2);
  });

  it('throws CHANNEL_NOT_QUEUEABLE on .queue() for non-email channel', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as { ping: { queue: () => Promise<unknown> } };

    const [err] = await (async () => {
      try {
        await mail.ping.queue();
        return [null];
      } catch (e) {
        return [e];
      }
    })();
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('CHANNEL_NOT_QUEUEABLE');
  });

  it('runs middleware on non-email channel route and threads ctx into render', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const seen: Array<{ tag: string }> = [];
    const ch = testChannel() as unknown as {
      render: (
        def: ChannelDefinition<TestArgs, TestRendered>,
        args: TestArgs,
        ctx: unknown,
      ) => Promise<TestRendered>;
      validateArgs: (a: unknown) => TestArgs;
      name: string;
      createBuilder: () => unknown;
      finalize: (s: unknown, id: string) => unknown;
      _transport: unknown;
    };
    ch.render = async (_def, args, ctx) => {
      seen.push({ tag: (ctx as { tag?: string }).tag ?? 'none' });
      return { body: `Hi ${args.input.name}`, to: args.to };
    };
    const mw = async ({ next }: { next: (c?: Record<string, unknown>) => Promise<unknown> }) =>
      next({ tag: 'mw-set' });
    const defs = catalog.definitions as unknown as Record<string, { middleware: unknown[] }>;
    const ping = defs.ping;
    if (!ping) throw new Error('ping missing');
    ping.middleware = [mw];

    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<{ messageId: string }> } };

    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(seen).toEqual([{ tag: 'mw-set' }]);
  });

  it('fires all four hook phases for non-email route in order', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const order: string[] = [];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      hooks: {
        onBeforeSend: [() => {
          order.push('before');
        }],
        onExecute: [({ rendered }: { rendered: unknown }) => {
          order.push('execute');
          if (!(rendered as unknown as TestRendered).body) throw new Error('rendered missing');
        }],
        onAfterSend: [({ result }: { result: { messageId?: string } }) => {
          order.push(`after:${result.messageId ? 'has-id' : 'no-id'}`);
        }],
        onError: [() => {
          order.push('error');
        }],
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };

    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(order).toEqual(['before', 'execute', 'after:has-id']);
  });

  it('routes middleware errors through onError with phase=middleware', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const errors: Array<{ phase: string; code: string }> = [];
    const mw = async () => {
      throw new Error('mw boom');
    };
    const defs = catalog.definitions as unknown as Record<string, { middleware: unknown[] }>;
    const ping = defs.ping;
    if (!ping) throw new Error('ping missing');
    ping.middleware = [mw];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(
      NotifyRpcError,
    );
    expect(errors).toEqual([{ phase: 'middleware', code: 'UNKNOWN' }]);
  });

  it('routes render errors through onError with phase=render', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const ch = testChannel() as unknown as {
      render: (...a: unknown[]) => Promise<TestRendered>;
      validateArgs: (a: unknown) => TestArgs;
      name: string;
      createBuilder: () => unknown;
      finalize: (s: unknown, id: string) => unknown;
      _transport: unknown;
    };
    ch.render = async () => {
      throw new Error('render boom');
    };
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(
      NotifyRpcError,
    );
    expect(errors).toEqual([{ phase: 'render', code: 'RENDER' }]);
  });

  it('routes transport errors through onError with phase=send', async () => {
    const catalog = buildTestCatalog();
    const transport: TestTransport = {
      name: 'failing',
      sent: [],
      send: async () => {
        throw new Error('transport boom');
      },
    };
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(
      NotifyRpcError,
    );
    expect(errors).toEqual([{ phase: 'send', code: 'PROVIDER' }]);
  });

  it('routes onBeforeSend hook errors through onError with phase=hook', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      hooks: {
        onBeforeSend: () => {
          throw new Error('hook boom');
        },
        onError: ({ phase }) => {
          errors.push({ phase });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeTruthy();
    expect(errors.some((e) => e.phase === 'hook')).toBe(true);
  });

  it('throws CONFIG when channel is missing for the route', async () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: {},
      transportsByChannel: {},
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toThrow(
      /No channel/,
    );
  });

  it('throws PROVIDER when transport is missing for the channel', async () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: {},
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toThrow(
      /No transport/,
    );
  });

  it('builds envelope when rendered has from + to addresses', async () => {
    const ch = testChannel() as unknown as { render: (...a: unknown[]) => Promise<unknown> };
    ch.render = async () => ({
      from: { email: 'sender@x.com' },
      to: [{ email: 'rcpt@x.com' }],
      body: 'hi',
    });
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: { send: (a: TestArgs) => Promise<{ envelope?: { from?: string; to: string[] } }> };
    };
    const result = await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(result.envelope).toEqual({ from: 'sender@x.com', to: ['rcpt@x.com'] });
  });

  it('builds envelope from string addresses', async () => {
    const ch = testChannel() as unknown as { render: (...a: unknown[]) => Promise<unknown> };
    ch.render = async () => ({
      from: 'sender@x.com',
      to: ['rcpt@x.com'],
      body: 'hi',
    });
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: { send: (a: TestArgs) => Promise<{ envelope?: { from?: string; to: string[] } }> };
    };
    const result = await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(result.envelope).toEqual({ from: 'sender@x.com', to: ['rcpt@x.com'] });
  });

  it('handles plugin onCreate / onClose lifecycle', async () => {
    const order: string[] = [];
    const plugin = {
      name: 'p',
      onCreate: () => order.push('create'),
      onClose: () => {
        order.push('close');
      },
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      plugins: [plugin],
    }) as unknown as { close: () => Promise<void> };
    expect(order).toEqual(['create']);
    await mail.close();
    expect(order).toEqual(['create', 'close']);
  });

  it('logs and swallows plugin onClose errors', async () => {
    const errs: unknown[] = [];
    const plugin = {
      name: 'p',
      onClose: () => {
        throw new Error('close fail');
      },
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      plugins: [plugin],
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (m: string, p?: unknown) => {
          errs.push({ m, p });
        },
        child: () =>
          ({
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: (m: string, p?: unknown) => {
              errs.push({ m, p });
            },
            child: () => ({}) as never,
          }) as never,
      } as never,
    }) as unknown as { close: () => Promise<void> };
    await mail.close();
    expect(errs.some((e) => (e as { m: string }).m === 'plugin close failed')).toBe(true);
  });

  it('returns undefined for unknown route on the proxy', () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as Record<string, unknown>;
    expect(mail.unknownRoute).toBeUndefined();
    expect(mail[Symbol.iterator as never]).toBeUndefined();
  });

  it('caches built proc methods (second access returns same instance)', () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: unknown };
    const a = mail.ping;
    const b = mail.ping;
    expect(a).toBe(b);
  });

  it('batch with errors per-entry, including BATCH_EMPTY guard', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: {
        batch: (entries: ReadonlyArray<TestArgs>) => Promise<{
          okCount: number;
          errorCount: number;
          results: ReadonlyArray<{ status: 'ok' | 'error'; index: number }>;
        }>;
      };
    };
    const r = await mail.ping.batch([
      { to: 'a@x.com', input: { name: 'A' } },
      { to: 'b@x.com', input: { name: 1 as unknown as string } },
    ]);
    expect(r.okCount).toBe(1);
    expect(r.errorCount).toBe(1);
  });

  it('queue() rejects with CHANNEL_NOT_QUEUEABLE through .catch()', async () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: { queue: () => Promise<unknown> } };
    await expect(mail.ping.queue()).rejects.toBeInstanceOf(NotifyRpcError);
  });

  it('render() throws CONFIG when channel does not implement previewRender', async () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: { render: (i: unknown) => Promise<unknown> } };
    await expect(mail.ping.render({ name: 'A' })).rejects.toThrow(/does not support .render/);
  });

  it('render() runs previewRender when channel provides it', async () => {
    const ch = testChannel() as unknown as {
      previewRender?: (def: unknown, input: unknown, ctx: unknown) => Promise<unknown>;
    };
    ch.previewRender = async (_d, input) => ({ preview: input });
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: { render: (i: unknown) => Promise<unknown> } };
    const out = await mail.ping.render({ name: 'A' });
    expect(out).toEqual({ preview: { name: 'A' } });
  });

  it('render() passes ctx through to previewRender', async () => {
    const ch = testChannel() as unknown as {
      previewRender?: (def: unknown, input: unknown, ctx: unknown) => Promise<unknown>;
    };
    ch.previewRender = async (_d, input, ctx) => ({ preview: input, ctx });
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as {
      ping: { render: (i: unknown, opts?: { ctx?: unknown }) => Promise<unknown> };
    };
    const out = await mail.ping.render({ name: 'A' }, { ctx: { userId: '1' } });
    expect(out).toEqual({ preview: { name: 'A' }, ctx: { userId: '1' } });
  });

  it('skips falsy entries in sparse plugins array', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    type AnyPlugin = NonNullable<Parameters<typeof createClient>[0]['plugins']>[number];
    const sparse: AnyPlugin[] = [];
    let closeCalled = false;
    sparse[1] = {
      name: 'real',
      hooks: { onAfterSend: () => {} },
      onClose: async () => {
        closeCalled = true;
      },
    } as AnyPlugin;

    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      plugins: sparse,
    }) as unknown as {
      ping: { send: (a: TestArgs) => Promise<unknown> };
      close: () => Promise<void>;
    };
    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    await mail.close();
    expect(closeCalled).toBe(true);
  });

  it('passes single hook function through toArray', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const order: string[] = [];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
      hooks: {
        onBeforeSend: () => { order.push('before'); },
        onExecute: () => { order.push('execute'); },
        onAfterSend: () => { order.push('after'); },
      },
      plugins: [{
        name: 'hook-test',
        hooks: {
          onBeforeSend: () => { order.push('p-before'); },
        },
      }],
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(order).toContain('before');
    expect(order).toContain('p-before');
  });

  it('middleware next() passes through ctx when called without args', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const ctxValues: unknown[] = [];
    const ch = testChannel() as unknown as {
      render: (...a: unknown[]) => Promise<TestRendered>;
    };
    ch.render = async (_def, args, ctx) => {
      ctxValues.push(ctx);
      return { body: 'x', to: (args as TestArgs).to };
    };
    const passthrough = async ({ next }: { next: () => Promise<unknown> }) => next();
    const defs = catalog.definitions as unknown as Record<string, { middleware: unknown[] }>;
    const ping = defs.ping;
    if (!ping) throw new Error('ping missing');
    ping.middleware = [passthrough];

    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
      ctx: { base: true } as never,
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(ctxValues[0]).toMatchObject({ base: true });
  });

  it('skips falsy entries in sparse middleware array', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const defs = catalog.definitions as unknown as Record<string, { middleware: unknown[] }>;
    const ping = defs.ping;
    if (!ping) throw new Error('ping missing');
    const sparse: unknown[] = [];
    sparse[1] = async ({ next }: { next: () => Promise<unknown> }) => next();
    ping.middleware = sparse;

    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    const result = await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(result).toBeDefined();
  });

  it('returns undefined for Symbol property access on proxy', () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    });
    expect((mail as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
  });

  it('preserves NotifyRpcError when transport throws one (no re-wrap)', async () => {
    const orig = new NotifyRpcError({ message: 'specific', code: 'PROVIDER' });
    const transport = {
      name: 'failing',
      sent: [] as unknown[],
      send: async () => {
        throw orig;
      },
    };
    const errors: Array<NotifyRpcError> = [];
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport as unknown as TestTransport },
      hooks: {
        onError: ({ error }) => {
          errors.push(error);
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBe(orig);
    expect(errors[0]).toBe(orig);
  });

  it('treats { ok: false } returned by transport as a soft failure', async () => {
    const transport = {
      name: 'soft-fail',
      sent: [] as unknown[],
      send: async () => ({ ok: false as const, error: new Error('soft') }),
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport as unknown as TestTransport },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toThrow(/soft/);
  });

  it('preserves NotifyRpcError thrown from middleware', async () => {
    const orig = new NotifyRpcError({ message: 'mw orig', code: 'CONFIG' });
    const catalog = buildTestCatalog();
    const defs = catalog.definitions as unknown as Record<string, { middleware: unknown[] }>;
    const ping = defs.ping;
    if (!ping) throw new Error('ping missing');
    ping.middleware = [
      async () => {
        throw orig;
      },
    ];
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBe(orig);
  });

  it('batch wraps non-NotifyRpcError transport throws with route-tagged NotifyRpcError', async () => {
    const transport = {
      name: 'bad',
      sent: [] as unknown[],
      send: async () => {
        throw new Error('plain');
      },
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport as unknown as TestTransport },
    }) as unknown as {
      ping: {
        batch: (e: ReadonlyArray<TestArgs>) => Promise<{
          results: ReadonlyArray<{ status: 'ok' | 'error'; index: number; error?: NotifyRpcError }>;
        }>;
      };
    };
    const r = await mail.ping.batch([{ to: 'a@x.com', input: { name: 'A' } }]);
    const first = r.results[0];
    if (!first || first.status !== 'error') throw new Error('expected error');
    expect(first.error).toBeInstanceOf(NotifyRpcError);
    expect(first.error?.route).toBe('ping');
  });

  it('batch with interval delays between entries', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: {
        batch: (
          e: ReadonlyArray<TestArgs>,
          opts?: { interval?: number },
        ) => Promise<{ okCount: number }>;
      };
    };
    const start = Date.now();
    await mail.ping.batch(
      [
        { to: 'a@x.com', input: { name: 'A' } },
        { to: 'b@x.com', input: { name: 'B' } },
      ],
      { interval: 5 },
    );
    expect(Date.now() - start).toBeGreaterThanOrEqual(4);
  });

  it('batch throws BATCH_EMPTY on empty entries array', async () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as { ping: { batch: (e: ReadonlyArray<TestArgs>) => Promise<unknown> } };
    await expect(mail.ping.batch([])).rejects.toThrow(NotifyRpcError);
  });

  it('access via nested catalog path works', async () => {
    const inner = buildTestCatalog();
    const outerCatalog = {
      _brand: 'Catalog' as const,
      _ctx: undefined as never,
      definitions: { 'ns.ping': inner.definitions.ping! },
      nested: { ns: inner },
      routes: ['ns.ping'],
    } as unknown as AnyCatalog;
    const transport = createTestTransport();
    const mail = createClient({
      catalog: outerCatalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as { ns: { ping: { send: (a: TestArgs) => Promise<unknown> } } };
    await mail.ns.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(transport.sent).toHaveLength(1);
  });

  it('proxy returns undefined for symbol keys', () => {
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as Record<symbol, unknown>;
    expect(mail[Symbol.iterator]).toBeUndefined();
  });

  it('routes onExecute hook errors through onError with phase=hook', async () => {
    const errors: Array<{ phase: string }> = [];
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      hooks: {
        onExecute: () => {
          throw new Error('execute hook boom');
        },
        onError: ({ phase }) => {
          errors.push({ phase });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeTruthy();
    expect(errors.some((e) => e.phase === 'hook')).toBe(true);
  });

  it('batch preserves NotifyRpcError thrown from transport', async () => {
    const orig = new NotifyRpcError({ message: 'original', code: 'PROVIDER' });
    const transport = {
      name: 'bad',
      sent: [] as unknown[],
      send: async () => {
        throw orig;
      },
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport as unknown as TestTransport },
    }) as unknown as {
      ping: {
        batch: (e: ReadonlyArray<TestArgs>) => Promise<{
          results: ReadonlyArray<{ status: 'ok' | 'error'; index: number; error?: NotifyRpcError }>;
        }>;
      };
    };
    const r = await mail.ping.batch([{ to: 'a@x.com', input: { name: 'A' } }]);
    const first = r.results[0];
    if (!first || first.status !== 'error') throw new Error('expected error');
    expect(first.error).toBe(orig);
  });

  it('batch single entry runs without delay branch', async () => {
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: {
        batch: (e: ReadonlyArray<TestArgs>, opts?: { interval?: number }) => Promise<unknown>;
      };
    };
    await mail.ping.batch([{ to: 'a@x.com', input: { name: 'A' } }], { interval: 100 });
    expect(transport.sent).toHaveLength(1);
  });

  it('reportHookError preserves err when hook threw an NotifyRpcError directly', async () => {
    const original = new NotifyRpcError({ message: 'pre-wrapped', code: 'UNKNOWN' });
    const errors: Array<{ error: NotifyRpcError }> = [];
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      hooks: {
        onBeforeSend: () => {
          throw original;
        },
        onError: ({ error }) => {
          errors.push({ error });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBe(original);
    expect(errors.some((e) => e.error === original)).toBe(true);
  });

  it('proxy returns undefined when nested entry has no matching definition', () => {
    const def = {
      id: 'ping',
      channel: 'test',
      schema: z.object({ name: z.string() }),
      middleware: [],
      runtime: { template: () => 'x' },
      _args: undefined as never,
      _rendered: undefined as never,
    };
    const orphan: AnyCatalog = {
      _brand: 'Catalog' as const,
      _ctx: undefined as never,
      definitions: {},
      nested: { ghost: def as unknown as Record<string, unknown> },
      routes: ['ghost'],
    };
    const mail = createClient({
      catalog: orphan,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as Record<string, unknown>;
    expect(mail.ghost).toBeUndefined();
  });

  it('routes onAfterSend hook errors through onError reporter', async () => {
    const errors: Array<{ phase: string }> = [];
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      hooks: {
        onAfterSend: () => {
          throw new Error('after boom');
        },
        onError: ({ phase }) => {
          errors.push({ phase });
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(errors.some((e) => e.phase === 'hook')).toBe(true);
  });

  it('batch wraps non-NotifyRpcError thrown by validateArgs', async () => {
    const ch = testChannel() as unknown as {
      validateArgs: (a: unknown) => unknown;
    };
    ch.validateArgs = () => {
      throw new Error('validate boom');
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: createTestTransport() },
    }) as unknown as {
      ping: {
        batch: (
          e: ReadonlyArray<TestArgs>,
        ) => Promise<{ results: ReadonlyArray<{ status: string; error?: NotifyRpcError }> }>;
      };
    };
    const r = await mail.ping.batch([{ to: 'a@x.com', input: { name: 'A' } }]);
    const first = r.results[0];
    if (!first || first.status !== 'error') throw new Error('expected error');
    expect(first.error).toBeInstanceOf(NotifyRpcError);
    expect(first.error?.message).toMatch(/validate boom/);
  });

  it('toEmailString returns empty string for malformed address values', async () => {
    const ch = testChannel() as unknown as { render: (...a: unknown[]) => Promise<unknown> };
    ch.render = async () => ({
      from: 42,
      to: [42],
      body: 'x',
    });
    const catalog = buildTestCatalog();
    const transport = createTestTransport();
    const mail = createClient({
      catalog,
      channels: { test: ch as unknown as AnyChannel },
      transportsByChannel: { test: transport },
    }) as unknown as {
      ping: { send: (a: TestArgs) => Promise<{ envelope?: { from?: string; to: string[] } }> };
    };
    const result = await mail.ping.send({ to: 'a@x.com', input: { name: 'A' } });
    expect(result.envelope).toEqual({ from: '', to: [''] });
  });

  it('logs nested hook failures when onError itself throws', async () => {
    const logs: Array<{ msg: string }> = [];
    const customLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (m: string) => {
        logs.push({ msg: m });
      },
      child: function (this: unknown) {
        return this as never;
      },
    };
    const catalog = buildTestCatalog();
    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: createTestTransport() },
      logger: customLogger as never,
      hooks: {
        onBeforeSend: () => {
          throw new Error('outer hook failure');
        },
        onError: () => {
          throw new Error('error-handler also throws');
        },
      },
    }) as unknown as { ping: { send: (a: TestArgs) => Promise<unknown> } };
    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeTruthy();
    expect(logs.filter((l) => l.msg === 'hook failed').length).toBeGreaterThanOrEqual(2);
  });
});
