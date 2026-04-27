import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createClient } from './client.js';
import { EmailRpcError } from './errors.js';
import type { AnyChannel, AnyEmailCatalog, ChannelDefinition } from './index.js';

type TestRendered = { body: string; to: string };

type TestArgs = { to: string; input: { name: string } };

type TestTransport = {
  name: string;
  sent: Array<{ rendered: TestRendered; route: string }>;
  send: (rendered: TestRendered, ctx: { route: string; messageId: string; attempt: number }) => Promise<{
    transportMessageId: string;
    accepted: string[];
    rejected: string[];
  }>;
};

const createTestTransport = (): TestTransport => {
  const sent: Array<{ rendered: TestRendered; route: string }> = [];
  return {
    name: 'test',
    sent,
    send: async (rendered, ctx) => {
      sent.push({ rendered, route: ctx.route });
      return {
        transportMessageId: `test-${ctx.messageId}`,
        accepted: [rendered.to],
        rejected: [],
      };
    },
  };
};

const testChannel = () => {
  const channel = {
    name: 'test',
    createBuilder: () => ({}),
    finalize: (state: unknown, id: string) => state as ChannelDefinition<TestArgs, TestRendered>,
    validateArgs: (args: unknown): TestArgs => {
      const a = args as Record<string, unknown>;
      if (!a.to || typeof a.to !== 'string') throw new Error('to required');
      return a as TestArgs;
    },
    render: async (
      def: ChannelDefinition<TestArgs, TestRendered>,
      args: TestArgs,
    ): Promise<TestRendered> => {
      const runtime = (def as ChannelDefinition<TestArgs, TestRendered> & {
        runtime: { template: (input: { name: string }) => string };
      }).runtime;
      return { body: runtime.template(args.input), to: args.to };
    },
    _transport: undefined as never,
  };
  return channel as unknown as AnyChannel;
};

const buildTestCatalog = (): AnyEmailCatalog => {
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
    _brand: 'EmailCatalog' as const,
    _ctx: undefined as never,
    emails: {},
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
        send: (a: TestArgs) => Promise<{ messageId: string; providerMessageId?: string }>;
      };
    };

    const result = await mail.ping.send({ to: 'alice@x.com', input: { name: 'Alice' } });
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.rendered.body).toBe('Hello Alice');
    expect(transport.sent[0]?.rendered.to).toBe('alice@x.com');
    expect(transport.sent[0]?.route).toBe('ping');
    expect(result.providerMessageId).toBe(`test-${result.messageId}`);
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
    expect(err).toBeInstanceOf(EmailRpcError);
    expect((err as EmailRpcError).code).toBe('CHANNEL_NOT_QUEUEABLE');
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
        onBeforeSend: () => {
          order.push('before');
        },
        onExecute: ({ rendered }) => {
          order.push('execute');
          if (!(rendered as unknown as TestRendered).body) throw new Error('rendered missing');
        },
        onAfterSend: ({ result }) => {
          order.push(`after:${result.messageId ? 'has-id' : 'no-id'}`);
        },
        onError: () => {
          order.push('error');
        },
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

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(EmailRpcError);
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

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(EmailRpcError);
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

    await expect(mail.ping.send({ to: 'a@x.com', input: { name: 'A' } })).rejects.toBeInstanceOf(EmailRpcError);
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
});
