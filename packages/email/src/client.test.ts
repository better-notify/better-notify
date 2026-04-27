import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createClient, createNotify, NotifyRpcError, type Middleware } from '@emailrpc/core';
import { emailChannel, mockTransport, multiTransport } from './index.js';
import type { TemplateAdapter } from './template.js';
import type { LoggerLike, LogLevel } from '@emailrpc/core';

type LogRecord = {
  level: LogLevel;
  message: string;
  bindings: Record<string, unknown>;
  payload: Record<string, unknown>;
};

type MemoryLogger = LoggerLike & {
  readonly records: ReadonlyArray<LogRecord>;
  clear(): void;
};

const buildMemoryLogger = (
  records: LogRecord[],
  bindings: Record<string, unknown>,
): MemoryLogger => {
  const push =
    (level: LogLevel) =>
    (message: string, payload?: object): void => {
      records.push({
        level,
        message,
        bindings: { ...bindings },
        payload: { ...((payload as Record<string, unknown>) ?? {}) },
      });
    };
  return {
    get records() {
      return records;
    },
    clear() {
      records.length = 0;
    },
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    child(extra) {
      return buildMemoryLogger(records, {
        ...bindings,
        ...(extra as Record<string, unknown>),
      });
    },
  };
};

const memoryLogger = (): MemoryLogger => buildMemoryLogger([], {});

const stubAdapter: TemplateAdapter<{ name: string }> = {
  render: async ({ input }) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

const buildEmailChannel = (defaults?: {
  from?: string | { name?: string; email?: string };
  replyTo?: string | { name?: string; email: string };
  headers?: Record<string, string>;
}) => emailChannel(defaults ? { defaults } : undefined);

const createTestCatalog = (defaults?: { from?: string }) => {
  const ch = buildEmailChannel(defaults);
  const rpc = createNotify({ channels: { email: ch } });
  return {
    catalog: rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(stubAdapter),
    }),
    channel: ch,
  };
};

describe('executeRender', () => {
  it('validates and renders a route', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'sender@example.com' });
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });

    const output = (await mail.welcome.render({ name: 'John Doe' })) as {
      html: string;
      text?: string;
    };
    expect(output.html).toBe('<p>Hello John Doe</p>');
    expect(output.text).toBe('Hello John Doe');
  });
});

describe('executeSend', () => {
  it('validates, renders, and sends through the email transport', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'hello@example.com' });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
    });

    const result = await mail.welcome.send({
      to: 'john@x.com',
      input: { name: 'John Doe' },
    });

    expect(result.messageId).toBeDefined();
    expect((result.data as { accepted: string[] }).accepted).toEqual(['john@x.com']);
    expect((result.data as { rejected: string[] }).rejected).toEqual([]);
    expect(result.envelope).toEqual({
      from: 'hello@example.com',
      to: ['john@x.com'],
    });
    expect(result.timing.renderMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.sendMs).toBeGreaterThanOrEqual(0);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['john@x.com'],
      subject: 'Welcome, John Doe!',
      html: '<p>Hello John Doe</p>',
    });
  });

  it('uses defaults.from when contract has no from', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'default@example.com' });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
    });

    const result = await mail.welcome.send({
      to: 'john@x.com',
      input: { name: 'John Doe' },
    });
    expect(result.envelope?.from).toBe('default@example.com');
  });

  it('uses adapter subject over definition subject when adapter returns one', async () => {
    const adapterWithSubject: TemplateAdapter<{ name: string }> = {
      render: async () => ({
        html: '<p>hi</p>',
        subject: 'From Adapter',
      }),
    };
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('From Definition')
        .template(adapterWithSubject),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(transport.sent[0]!.subject).toBe('From Adapter');
  });

  it('throws validation error for invalid input', async () => {
    const { catalog, channel } = createTestCatalog();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });

    await expect(
      mail.welcome.send({
        to: 'john@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow('Validation failed');
  });

  it('renders without from when no source provides one (transport may reject)', async () => {
    const { catalog, channel } = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(transport.sent[0]?.from).toBeUndefined();
  });

  it('accepts an array of recipients', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
    });

    const result = await mail.welcome.send({
      to: ['a@x.com', 'b@x.com'],
      input: { name: 'John Doe' },
    });
    expect(result.envelope?.to).toEqual(['a@x.com', 'b@x.com']);
  });

  it('forwards cc, bcc, replyTo, headers, and attachments to the provider', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com', headers: { 'X-Default': '1' } });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({
      to: 'john@x.com',
      cc: 'team@x.com',
      bcc: ['legal@x.com', 'audit@x.com'],
      replyTo: 'support+ticket-42@x.com',
      headers: { 'X-Custom': 'yes' },
      attachments: [{ filename: 'a.txt', content: 'hello' }],
      input: { name: 'John Doe' },
    });

    const sent = transport.sent[0]!;
    expect(sent.cc).toEqual(['team@x.com']);
    expect(sent.bcc).toEqual(['legal@x.com', 'audit@x.com']);
    expect(sent.replyTo).toBe('support+ticket-42@x.com');
    expect(sent.headers['X-Default']).toBe('1');
    expect(sent.headers['X-Custom']).toBe('yes');
    expect(sent.attachments).toBe(1);
  });

  it('per-send replyTo overrides def and defaults', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com', replyTo: { email: 'defaults@x.com' } });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .replyTo({ email: 'def@x.com' })
        .subject('s')
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({
      to: 'john@x.com',
      replyTo: 'override@x.com',
      input: { name: 'John Doe' },
    });
    expect(transport.sent[0]!.replyTo).toBe('override@x.com');
  });

  it('per-send headers override default headers on key collision', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com', headers: { 'X-Source': 'default' } });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({
      to: 'john@x.com',
      headers: { 'X-Source': 'send' },
      input: { name: 'John Doe' },
    });
    expect(transport.sent[0]!.headers['X-Source']).toBe('send');
  });
});

describe('client hooks', () => {
  it('fires onBeforeSend and onAfterSend', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onBeforeSend: ({ route, messageId }) => {
          calls.push(`before:${route}:${messageId}`);
        },
        onAfterSend: ({ route, durationMs }) => {
          calls.push(`after:${route}`);
          expect(durationMs).toBeGreaterThanOrEqual(0);
        },
      },
    });

    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^before:welcome:/);
    expect(calls[1]).toBe('after:welcome');
  });

  it('fires onError on validation failure', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const errors: Array<{ phase: string; route: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onError: ({ route, phase }) => {
          errors.push({ route, phase });
        },
      },
    });

    await expect(
      mail.welcome.send({
        to: 'john@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ route: 'welcome', phase: 'validate' });
  });

  it('hook errors do not affect the send result', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onAfterSend: () => {
          throw new Error('hook boom');
        },
      },
    });

    const result = await mail.welcome.send({
      to: 'john@x.com',
      input: { name: 'John Doe' },
    });
    expect((result.data as { accepted: string[] }).accepted).toEqual(['john@x.com']);
  });

  it('fires onExecute with the rendered message', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    let captured: { subject: string; html: string } | undefined;
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onExecute: ({ rendered }) => {
          const r = rendered as unknown as { subject: string; html: string };
          captured = { subject: r.subject, html: r.html };
        },
      },
    });
    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(captured?.subject).toBe('Welcome, John Doe!');
  });

  it('throw in onBeforeSend aborts the send and re-emits via onError(phase: hook)', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const transport = mockTransport();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
      hooks: {
        onBeforeSend: () => {
          throw new Error('hook abort');
        },
        onError: ({ phase }) => {
          errors.push({ phase });
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toThrow('hook abort');
    expect(transport.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('multi-hook registration runs all in order', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onAfterSend: [
          () => {
            calls.push('a');
          },
          () => {
            calls.push('b');
          },
          () => {
            calls.push('c');
          },
        ],
      },
    });
    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('a thrown hook in the middle of onAfterSend does not stop subsequent hooks', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onAfterSend: [
          () => {
            calls.push('a');
          },
          () => {
            throw new Error('boom');
          },
          () => {
            calls.push('c');
          },
        ],
      },
    });
    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(calls).toEqual(['a', 'c']);
  });
});

describe('multi-transport failover order', () => {
  it('uses the first transport on success via multiTransport failover', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const primary = mockTransport();
    const secondary = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: {
        email: multiTransport({
          strategy: 'failover',
          transports: [{ transport: primary }, { transport: secondary }],
        }),
      },
    });

    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(primary.sent).toHaveLength(1);
    expect(secondary.sent).toHaveLength(0);
  });
});

describe('proxy behavior', () => {
  it('caches route methods — same object on repeated access', () => {
    const { catalog, channel } = createTestCatalog();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });

    const a = mail.welcome;
    const b = mail.welcome;
    expect(a).toBe(b);
  });

  it('returns undefined for routes not in the catalog', () => {
    const { catalog, channel } = createTestCatalog();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });

    expect((mail as never as Record<string, unknown>).nonexistent).toBeUndefined();
  });

  it('route methods are frozen', () => {
    const { catalog, channel } = createTestCatalog();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });

    expect(Object.isFrozen(mail.welcome)).toBe(true);
  });

  it('returns undefined for symbol keys on nested sub-proxies', () => {
    const ch = buildEmailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const transactional = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(stubAdapter)
        .from('s@x.com'),
    });
    const root = rpc.catalog({ transactional });
    const mail = createClient({
      catalog: root,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
    });

    const subProxy = (mail as unknown as Record<string, unknown>).transactional as Record<
      symbol,
      unknown
    >;
    expect(subProxy[Symbol.iterator]).toBeUndefined();
  });

  it('exposes nested catalogs as sub-proxies with dot-path routes', async () => {
    const ch = buildEmailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const transactional = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Hi ${input.name}`)
        .template(stubAdapter)
        .from('sender@x.com'),
    });
    const root = rpc.catalog({ transactional });

    const transport = mockTransport();
    const mail = createClient({
      catalog: root,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    const subProxy = (mail as unknown as Record<string, Record<string, unknown>>).transactional;
    expect(subProxy).toBeDefined();
    const result = await (
      mail as unknown as {
        transactional: { welcome: { send: (a: unknown) => Promise<{ messageId: string }> } };
      }
    ).transactional.welcome.send({ to: 'a@b.com', input: { name: 'John Doe' } });
    expect(result.messageId).toBeDefined();
    const sent = transport.sent[0];
    expect(sent?.subject).toBe('Hi John Doe');
  });
});

describe('error pipeline', () => {
  it('wraps render failures in NotifyRpcError with code RENDER and fires onError', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => {
        throw new Error('boom');
      },
    };
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const errors: Array<{ phase: string; route: string; code: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onError: ({ route, phase, error }) => {
          errors.push({ route, phase, code: error.code });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toMatchObject({ code: 'RENDER', route: 'welcome' });
    expect(errors).toEqual([{ route: 'welcome', phase: 'render', code: 'RENDER' }]);
  });

  it('wraps render failures even without an onError hook', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => {
        throw new Error('boom');
      },
    };
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
    });
    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toMatchObject({ code: 'RENDER' });
  });

  it('throws when no transport is registered for the email channel', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: {},
    });
    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toThrow();
  });

  it('wraps non-NotifyRpcError provider failures with code PROVIDER', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const failingProvider = {
      name: 'failing',
      send: async () => {
        throw new Error('smtp down');
      },
    };
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: failingProvider },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toMatchObject({ code: 'PROVIDER', route: 'welcome' });
    expect(errors).toEqual([{ phase: 'send', code: 'PROVIDER' }]);
  });

  it('passes through NotifyRpcError thrown by the provider as-is', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const original = new NotifyRpcError({
      message: 'rate limited',
      code: 'PROVIDER',
    });
    const failingProvider = {
      name: 'failing',
      send: async () => {
        throw original;
      },
    };
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: failingProvider },
    });
    await expect(mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } })).rejects.toBe(
      original,
    );
  });

  it('logs hook errors through structured logger without affecting the failure', async () => {
    const log = memoryLogger();
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      logger: log,
      hooks: {
        onError: () => {
          throw new Error('hook boom');
        },
      },
    });
    await expect(
      mail.welcome.send({
        to: 'john@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onError');
  });
});

describe('error pipeline (extra)', () => {
  it('throw in onExecute aborts the send and re-emits via onError(phase: hook)', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const transport = mockTransport();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: transport },
      hooks: {
        onExecute: () => {
          throw new Error('execute abort');
        },
        onError: ({ phase }) => {
          errors.push({ phase });
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).rejects.toThrow('execute abort');
    expect(transport.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('passes through NotifyRpcError thrown inside an onError handler without rewrapping', async () => {
    const log = memoryLogger();
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      logger: log,
      hooks: {
        onError: () => {
          throw new NotifyRpcError({
            message: 'rpc-handler-err',
            code: 'UNKNOWN',
          });
        },
      },
    });
    await expect(
      mail.welcome.send({
        to: 'john@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onError');
  });

  it('wraps a raw error thrown by user middleware as code UNKNOWN with phase middleware', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const breakingMw: Middleware = async () => {
      throw new Error('mw broke');
    };
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(breakingMw)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } }),
    ).rejects.toMatchObject({ code: 'UNKNOWN', route: 'welcome' });
    expect(errors).toEqual([{ phase: 'middleware', code: 'UNKNOWN' }]);
  });

  it('does NOT double-fire onError when an inner hook (onExecute) re-throws and middleware wraps it', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const passthroughMw: Middleware = async ({ next }) => next();
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(passthroughMw)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const phases: string[] = [];
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onExecute: () => {
          throw new Error('boom');
        },
        onError: ({ phase }) => {
          phases.push(phase);
        },
      },
    });
    await expect(mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } })).rejects.toThrow(
      'boom',
    );
    expect(phases).toEqual(['hook']);
  });
});

describe('plugin lifecycle (extra)', () => {
  it('continues onClose even if one plugin onClose throws', async () => {
    const order: string[] = [];
    const log = memoryLogger();
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      logger: log,
      plugins: [
        {
          name: 'a',
          onClose: () => {
            order.push('a');
          },
        },
        {
          name: 'b',
          onClose: () => {
            throw new Error('close boom');
          },
        },
        {
          name: 'c',
          onClose: () => {
            order.push('c');
          },
        },
      ],
    });
    await mail.close();
    expect(order).toEqual(['c', 'a']);
    const rec = log.records.find((r) => r.message === 'plugin close failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.plugin).toBe('b');
  });
});

describe('address normalization', () => {
  it('normalizes Address objects on from and to into envelope strings', async () => {
    const ch = buildEmailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .from({ name: 'Sender', email: 'sender@x.com' })
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });
    const result = await mail.welcome.send({
      to: { name: 'John Doe', email: 'john@x.com' },
      input: { name: 'John Doe' },
    });
    expect(result.envelope).toEqual({
      from: 'sender@x.com',
      to: ['john@x.com'],
    });
  });
});

describe('proxy with symbol keys', () => {
  it('returns undefined for symbol property access', () => {
    const { catalog, channel } = createTestCatalog();
    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
    });
    expect((mail as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
  });
});

describe('tags', () => {
  it('exposes definition tags on the rendered message tags field', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .tags({ tier: 'pro', count: 3, beta: true })
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });
    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    const tags = transport.sent[0]!.tags;
    expect(tags).toEqual({ tier: 'pro', count: 3, beta: true });
  });
});

describe('client middleware (onion)', () => {
  it('runs middleware in onion order', async () => {
    const calls: string[] = [];
    const mw1: Middleware = async ({ next }) => {
      calls.push('mw1 enter');
      const r = await next();
      calls.push('mw1 exit');
      return r;
    };
    const mw2: Middleware = async ({ next }) => {
      calls.push('mw2 enter');
      const r = await next();
      calls.push('mw2 exit');
      return r;
    };

    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(mw1)
        .use(mw2)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } });

    expect(calls).toEqual(['mw1 enter', 'mw2 enter', 'mw2 exit', 'mw1 exit']);
  });

  it('short-circuit middleware skips render and provider.send', async () => {
    const transport = mockTransport();
    const shortCircuit: Middleware = async () =>
      ({
        messageId: 'fake',
        data: { accepted: [], rejected: ['x@y.com'] },
        envelope: { from: 'a@b.com', to: ['x@y.com'] },
        timing: { renderMs: 0, sendMs: 0 },
      }) as never;

    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(shortCircuit)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({
          render: async () => {
            throw new Error('should not render');
          },
        }),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });
    const result = await mail.welcome.send({
      to: 'x@y.com',
      input: { name: 'John Doe' },
    });
    expect((result.data as { rejected: string[] }).rejected).toEqual(['x@y.com']);
    expect(transport.sent).toEqual([]);
  });

  it('middleware can mutate ctx visible to downstream middleware', async () => {
    let observed: unknown;
    const setMw: Middleware = async ({ next }) => next({ tenantId: 'acme' });
    const readMw: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };

    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(setMw)
        .use(readMw)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } });
    expect(observed).toMatchObject({ tenantId: 'acme' });
  });
});

describe('integration: full end-to-end', () => {
  it('builds a catalog, creates a client, sends and renders', async () => {
    const ch = buildEmailChannel();
    const rpc = createNotify({ channels: { email: ch } });

    const adapter: TemplateAdapter<{ name: string; verifyUrl: string }> = {
      render: async ({ input }) => ({
        html: `<h1>Welcome ${input.name}</h1><a href="${input.verifyUrl}">Verify</a>`,
        text: `Welcome ${input.name}! Verify: ${input.verifyUrl}`,
      }),
    };

    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(
          z.object({
            name: z.string(),
            verifyUrl: z.string().url(),
          }),
        )
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .from('hello@example.com')
        .template(adapter),
    });

    const transport = mockTransport();
    const hookCalls: string[] = [];

    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
      hooks: {
        onBeforeSend: () => {
          hookCalls.push('before');
        },
        onAfterSend: () => {
          hookCalls.push('after');
        },
      },
    });

    const result = await mail.welcome.send({
      to: 'john@x.com',
      input: {
        name: 'John Doe',
        verifyUrl: 'https://example.com/verify/abc',
      },
    });

    expect(result.messageId).toBeDefined();
    expect((result.data as { accepted: string[] }).accepted).toEqual(['john@x.com']);
    expect(result.envelope).toEqual({
      from: 'hello@example.com',
      to: ['john@x.com'],
    });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['john@x.com'],
      subject: 'Welcome, John Doe!',
      html: '<h1>Welcome John Doe</h1><a href="https://example.com/verify/abc">Verify</a>',
    });

    expect(hookCalls).toEqual(['before', 'after']);

    const output = (await mail.welcome.render({
      name: 'John Doe',
      verifyUrl: 'https://example.com/verify/abc',
    })) as { html: string; text?: string };
    expect(output.html).toContain('Welcome John Doe');
    expect(output.text).toContain('Verify');
  });
});

type LoggerTestOpts = {
  logger?: import('@emailrpc/core').LoggerLike;
  transportThrows?: Error;
  onAfterSend?: () => void;
};

const makeClientForLoggerTests = (opts: LoggerTestOpts) => {
  const ch = buildEmailChannel();
  const rpc = createNotify({ channels: { email: ch } });
  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .from('a@b.com')
      .template({ render: async () => ({ html: '<p>hi</p>' }) }),
  });
  const transport = opts.transportThrows
    ? {
        name: 'mock',
        send: async () => {
          throw opts.transportThrows!;
        },
      }
    : mockTransport();
  const client = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: transport },
    logger: opts.logger,
    hooks: opts.onAfterSend ? { onAfterSend: opts.onAfterSend } : undefined,
  });
  return { client };
};

describe('client logger integration', () => {
  it('logs send entry, send ok with messageId/route bindings on success', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({ logger: log });
    await client.welcome.send({ to: 'a@b.com', input: { name: 'x' } });
    const ok = log.records.find((r) => r.message === 'send ok');
    expect(ok?.level).toBe('info');
    expect(ok?.bindings).toMatchObject({
      component: 'client',
      route: 'welcome',
    });
    expect(ok?.bindings.messageId).toEqual(expect.any(String));
    expect(ok?.payload).toMatchObject({
      durationMs: expect.any(Number),
    });
  });

  it('logs validate failed at warn with err', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({ logger: log });
    await expect(
      client.welcome.send({
        to: 'a@b.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'validate failed');
    expect(rec?.level).toBe('warn');
    expect(rec?.payload.err).toBeInstanceOf(Error);
  });

  it('logs send failed at error with err and durationMs when provider rejects', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({
      logger: log,
      transportThrows: new Error('smtp down'),
    });
    await expect(client.welcome.send({ to: 'a@b.com', input: { name: 'x' } })).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'send failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.err).toBeInstanceOf(Error);
    expect(rec?.payload.durationMs).toEqual(expect.any(Number));
  });

  it('logs hook failed at error and does not propagate', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({
      logger: log,
      onAfterSend: () => {
        throw new Error('hook boom');
      },
    });
    await expect(
      client.welcome.send({ to: 'a@b.com', input: { name: 'x' } }),
    ).resolves.toBeDefined();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onAfterSend');
  });

  it('default logger emits no records on success and one console.error on failure', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { client: ok } = makeClientForLoggerTests({});
    await ok.welcome.send({ to: 'a@b.com', input: { name: 'x' } });
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();

    const { client: bad } = makeClientForLoggerTests({
      transportThrows: new Error('x'),
    });
    await expect(bad.welcome.send({ to: 'a@b.com', input: { name: 'x' } })).rejects.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    infoSpy.mockRestore();
  });
});

describe('coverage gaps', () => {
  it('.template() accepts a render-function form and normalizes it into an adapter', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Hi ${input.name}`)
        .template(({ input, ctx }) => {
          const c = ctx as { baseUrl: string };
          return {
            html: `<p>Hi ${input.name} at ${c.baseUrl}</p>`,
            text: `Hi ${input.name} at ${c.baseUrl}`,
          };
        }),
    });

    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
      ctx: { baseUrl: 'example.com' },
    });

    const result = await mail.welcome.send({
      to: 'john@x.com',
      input: { name: 'John Doe' },
    });

    expect((result.data as { accepted: string[] }).accepted).toEqual(['john@x.com']);
    expect(transport.sent[0]).toMatchObject({
      html: '<p>Hi John Doe at example.com</p>',
      text: 'Hi John Doe at example.com',
    });
  });

  it('.template() render-function form supports async return', async () => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .subject('Hi')
        .template(async ({ input }) => ({
          html: `<p>${input.name}</p>`,
        })),
    });

    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(transport.sent[0]?.html).toBe('<p>John Doe</p>');
  });

  it('skips undefined entries in the middleware chain', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    const realMw: Middleware<unknown, unknown, unknown> = async ({ next }) => next();
    const withHoles = [undefined as unknown as Middleware<unknown, unknown, unknown>, realMw];

    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      plugins: [{ name: 'sparse-mw', middleware: withHoles }],
    });

    await expect(
      mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } }),
    ).resolves.toBeDefined();
  });

  it('skips undefined slots in a sparse plugins array on close', async () => {
    const { catalog, channel } = createTestCatalog({ from: 'a@b.com' });
    type AnyPlugin = NonNullable<Parameters<typeof createClient>[0]['plugins']>[number];
    const sparsePlugins: AnyPlugin[] = [];
    sparsePlugins[1] = {
      name: 'p1',
      onClose: async () => {},
    } as AnyPlugin;

    const mail = createClient({
      catalog,
      channels: { email: channel },
      transportsByChannel: { email: mockTransport() },
      plugins: sparsePlugins,
    });

    await expect(mail.close()).resolves.toBeUndefined();
  });
});

describe('kitchen-sink: rate-limit + suppression + idempotency', () => {
  const buildKitchenCatalog = (mws: ReadonlyArray<Middleware>) => {
    const ch = buildEmailChannel({ from: 'a@b.com' });
    const rpc = createNotify({ channels: { email: ch } });
    let chain: ReturnType<typeof rpc.email> = rpc.email();
    for (const mw of mws) chain = chain.use(mw);
    return {
      ch,
      catalog: rpc.catalog({
        welcome: chain
          .input(z.object({ name: z.string() }))
          .subject(({ input }) => `Welcome, ${input.name}!`)
          .template(stubAdapter),
      }),
    };
  };

  it('chains all three: rate limit OK, not suppressed, fresh — provider sends and idempotency caches', async () => {
    const {
      withRateLimit,
      withIdempotency,
      inMemoryRateLimitStore,
      inMemorySuppressionList,
      inMemoryIdempotencyStore,
    } = await import('@emailrpc/core');
    const { withSuppressionList } = await import('./index.js');

    const idemStore = inMemoryIdempotencyStore<{ messageId: string }>();
    const { ch, catalog } = buildKitchenCatalog([
      withRateLimit({ store: inMemoryRateLimitStore(), key: 'global', max: 10, window: 60_000 }),
      withSuppressionList({ list: inMemorySuppressionList() }),
      withIdempotency({ store: idemStore, key: 'idem-key', ttl: 60_000 }),
    ]);
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    const first = await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(transport.sent).toHaveLength(1);
    const cached = await idemStore.get('idem-key');
    expect(cached?.messageId).toBe(first.messageId);

    const second = await mail.welcome.send({ to: 'john@x.com', input: { name: 'John Doe' } });
    expect(second.messageId).toBe(first.messageId);
    expect(transport.sent).toHaveLength(1);
  });

  it('suppression short-circuit does NOT write to idempotency store', async () => {
    const { withIdempotency, inMemorySuppressionList, inMemoryIdempotencyStore } =
      await import('@emailrpc/core');
    const { withSuppressionList } = await import('./index.js');

    const list = inMemorySuppressionList();
    await list.set('blocked@x.com', { reason: 'unsubscribe', createdAt: new Date() });
    const idemStore = inMemoryIdempotencyStore<{ messageId: string }>();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const { ch, catalog } = buildKitchenCatalog([
        withSuppressionList({ list }),
        withIdempotency({ store: idemStore, key: 'idem-key', ttl: 60_000 }),
      ]);
      const transport = mockTransport();
      const mail = createClient({
        catalog,
        channels: { email: ch },
        transportsByChannel: { email: transport },
      });

      const result = await mail.welcome.send({
        to: 'blocked@x.com',
        input: { name: 'John Doe' },
      });
      expect(result.messageId).toBe('suppressed');
      expect(transport.sent).toHaveLength(0);
      expect(await idemStore.get('idem-key')).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rate-limit throw does NOT write to idempotency store', async () => {
    const {
      withRateLimit,
      withIdempotency,
      inMemoryRateLimitStore,
      inMemoryIdempotencyStore,
      NotifyRpcRateLimitedError,
    } = await import('@emailrpc/core');

    const idemStore = inMemoryIdempotencyStore<{ messageId: string }>();
    const { ch, catalog } = buildKitchenCatalog([
      withRateLimit({
        store: inMemoryRateLimitStore(),
        key: 'global',
        max: 1,
        window: 60_000,
      }),
      withIdempotency({ store: idemStore, key: 'idem-key', ttl: 60_000 }),
    ]);
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: transport },
    });

    await mail.welcome.send({ to: 'a@x.com', input: { name: 'John Doe' } });
    expect(transport.sent).toHaveLength(1);
    const cachedAfterFirst = await idemStore.get('idem-key');
    expect(cachedAfterFirst).not.toBeNull();

    await idemStore.set('idem-key', { ...cachedAfterFirst!, messageId: 'sentinel' }, 60_000);

    await expect(
      mail.welcome.send({ to: 'b@x.com', input: { name: 'John Doe' } }),
    ).rejects.toBeInstanceOf(NotifyRpcRateLimitedError);
    expect(transport.sent).toHaveLength(1);
    expect((await idemStore.get('idem-key'))?.messageId).toBe('sentinel');
  });
});
