import { describe, expect, it, expectTypeOf, vi } from 'vitest';
import { z } from 'zod';
import { createEmailRpc } from './index.js';
import { createClient } from './client.js';
import { memoryLogger } from './lib/test-utils.js';
import { mockTransport } from './lib/mock-transport.js';
import { EmailRpcError } from './errors.js';
import type { TemplateAdapter } from './template.js';
import type { SendOptions } from './client.js';
import type { Transport, TransportEntry } from './transports/types.js';
import type { Middleware } from './middlewares/types.js';

const stubAdapter: TemplateAdapter<{ name: string }> = {
  render: async ({ input }) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

const createTestCatalog = () => {
  const t = createEmailRpc();
  return t.catalog({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter),
  });
};

describe('client types', () => {
  it('SendOptions infers provider names from the transports tuple', () => {
    type Entries = readonly [
      { name: 'ses'; transport: Transport; priority: 1 },
      { name: 'smtp'; transport: Transport; priority: 2 },
    ];
    type Opts = SendOptions<Entries>;
    expectTypeOf<Opts['transport']>().toEqualTypeOf<'ses' | 'smtp' | undefined>();
  });

  it('TransportEntry has correct shape', () => {
    expectTypeOf<TransportEntry>().toMatchTypeOf<{
      name: string;
      transport: Transport;
      priority: number;
    }>();
  });
});

describe('executeRender', () => {
  it('validates and renders a route', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    const output = await mail.welcome.render({ name: 'Lucas' });
    expect(output.html).toBe('<p>Hello Lucas</p>');
    expect(output.text).toBe('Hello Lucas');
  });

  it('returns html string when format is html', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    const html = await mail.welcome.render({ name: 'Lucas' }, { format: 'html' });
    expect(html).toBe('<p>Hello Lucas</p>');
  });

  it('returns empty string when format is text and adapter has no text', async () => {
    const noTextAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '<p>hi</p>' }),
    };
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('Hi')
        .template(noTextAdapter),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    const text = await mail.welcome.render({ name: 'Lucas' }, { format: 'text' });
    expect(text).toBe('');
  });

  it('throws EmailRpcValidationError for invalid input', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    await expect(mail.welcome.render({ name: 123 as unknown as string })).rejects.toThrow(
      'Validation failed',
    );
  });
});

describe('executeSend', () => {
  it('validates, renders, and sends through the default provider', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'hello@example.com' },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      input: { name: 'Lucas' },
    });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.rejected).toEqual([]);
    expect(result.envelope).toEqual({
      from: 'hello@example.com',
      to: ['lucas@x.com'],
    });
    expect(result.timing.renderMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.sendMs).toBeGreaterThanOrEqual(0);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Welcome, Lucas!',
      html: '<p>Hello Lucas</p>',
    });
  });

  it('uses defaults.from when contract has no from', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'default@example.com' },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      input: { name: 'Lucas' },
    });
    expect(result.envelope.from).toBe('default@example.com');
  });

  it('uses adapter subject over definition subject when adapter returns one', async () => {
    const adapterWithSubject: TemplateAdapter<{ name: string }> = {
      render: async () => ({
        html: '<p>hi</p>',
        subject: 'From Adapter',
      }),
    };
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('From Definition')
        .template(adapterWithSubject),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(transport.sent[0]!.subject).toBe('From Adapter');
  });

  it('throws validation error for invalid input', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({
        to: 'lucas@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow('Validation failed');
  });

  it('throws when no from address is available', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('from');
  });

  it('accepts an array of recipients', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    const result = await mail.welcome.send({
      to: ['a@x.com', 'b@x.com'],
      input: { name: 'Lucas' },
    });
    expect(result.envelope.to).toEqual(['a@x.com', 'b@x.com']);
  });

  it('forwards cc, bcc, replyTo, headers, and attachments to the provider', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com', headers: { 'X-Default': '1' } },
    });

    await mail.welcome.send({
      to: 'lucas@x.com',
      cc: 'team@x.com',
      bcc: ['legal@x.com', 'audit@x.com'],
      replyTo: 'support+ticket-42@x.com',
      headers: { 'X-Custom': 'yes' },
      attachments: [{ filename: 'a.txt', content: 'hello' }],
      input: { name: 'Lucas' },
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
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .replyTo('def@x.com')
        .subject('s')
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com', replyTo: 'defaults@x.com' },
    });

    await mail.welcome.send({
      to: 'lucas@x.com',
      replyTo: 'override@x.com',
      input: { name: 'Lucas' },
    });
    expect(transport.sent[0]!.replyTo).toBe('override@x.com');
  });

  it('per-send headers override default headers on key collision', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com', headers: { 'X-Source': 'default' } },
    });

    await mail.welcome.send({
      to: 'lucas@x.com',
      headers: { 'X-Source': 'send' },
      input: { name: 'Lucas' },
    });
    expect(transport.sent[0]!.headers['X-Source']).toBe('send');
  });
});

describe('provider selection', () => {
  it('uses the lowest-priority provider by default', async () => {
    const catalog = createTestCatalog();
    const primary = mockTransport();
    const secondary = mockTransport();
    const mail = createClient({
      catalog,
      transports: [
        { name: 'secondary', transport: secondary, priority: 2 },
        { name: 'primary', transport: primary, priority: 1 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(primary.sent).toHaveLength(1);
    expect(secondary.sent).toHaveLength(0);
  });

  it('overrides to a named provider', async () => {
    const catalog = createTestCatalog();
    const primary = mockTransport();
    const secondary = mockTransport();
    const mail = createClient({
      catalog,
      transports: [
        { name: 'primary', transport: primary, priority: 1 },
        { name: 'secondary', transport: secondary, priority: 2 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send(
      { to: 'lucas@x.com', input: { name: 'Lucas' } },
      { transport: 'secondary' },
    );
    expect(primary.sent).toHaveLength(0);
    expect(secondary.sent).toHaveLength(1);
  });

  it('throws for unknown provider name', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await expect(
      mail.welcome.send(
        { to: 'lucas@x.com', input: { name: 'Lucas' } },
        { transport: 'nonexistent' as never },
      ),
    ).rejects.toThrow('not registered');
  });
});

describe('client hooks', () => {
  it('fires onBeforeSend and onAfterSend', async () => {
    const catalog = createTestCatalog();
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^before:welcome:/);
    expect(calls[1]).toBe('after:welcome');
  });

  it('fires onError on validation failure', async () => {
    const catalog = createTestCatalog();
    const errors: Array<{ phase: string; route: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ route, phase }) => {
          errors.push({ route, phase });
        },
      },
    });

    await expect(
      mail.welcome.send({
        to: 'lucas@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ route: 'welcome', phase: 'validate' });
  });

  it('hook errors do not affect the send result', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onAfterSend: () => {
          throw new Error('hook boom');
        },
      },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      input: { name: 'Lucas' },
    });
    expect(result.accepted).toEqual(['lucas@x.com']);
  });

  it('fires onExecute with the rendered message', async () => {
    const catalog = createTestCatalog();
    let captured: { subject: string; html: string } | undefined;
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onExecute: ({ rendered }) => {
          captured = { subject: rendered.subject, html: rendered.html };
        },
      },
    });
    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(captured?.subject).toBe('Welcome, Lucas!');
  });

  it('throw in onBeforeSend aborts the send and re-emits via onError(phase: hook)', async () => {
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
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
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('hook abort');
    expect(transport.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('multi-hook registration runs all in order', async () => {
    const catalog = createTestCatalog();
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('a thrown hook in the middle of onAfterSend does not stop subsequent hooks', async () => {
    const catalog = createTestCatalog();
    const calls: string[] = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(calls).toEqual(['a', 'c']);
  });
});

describe('type inference', () => {
  it('client routes have correct send args type', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [
        { name: 'ses', transport: mockTransport(), priority: 1 },
        { name: 'smtp', transport: mockTransport(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send).parameter(0).toMatchTypeOf<{
      to:
        | string
        | { name?: string; email: string }
        | Array<string | { name?: string; email: string }>;
      input: { name: string };
    }>();

    expectTypeOf(mail.welcome.render).parameter(0).toMatchTypeOf<{ name: string }>();
  });

  it('send options autocomplete provider names', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [
        { name: 'ses', transport: mockTransport(), priority: 1 },
        { name: 'smtp', transport: mockTransport(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send)
      .parameter(1)
      .toMatchTypeOf<{ transport?: 'ses' | 'smtp' } | undefined>();
  });
});

describe('proxy behavior', () => {
  it('caches route methods — same object on repeated access', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    const a = mail.welcome;
    const b = mail.welcome;
    expect(a).toBe(b);
  });

  it('returns undefined for routes not in the catalog', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    expect((mail as never as Record<string, unknown>).nonexistent).toBeUndefined();
  });

  it('route methods are frozen', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });

    expect(Object.isFrozen(mail.welcome)).toBe(true);
  });
});

describe('error pipeline', () => {
  it('wraps render failures in EmailRpcError with code RENDER and fires onError', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => {
        throw new Error('boom');
      },
    };
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const errors: Array<{ phase: string; route: string; code: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ route, phase, error }) => {
          errors.push({ route, phase, code: error.code });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toMatchObject({ code: 'RENDER', route: 'welcome' });
    expect(errors).toEqual([{ route: 'welcome', phase: 'render', code: 'RENDER' }]);
  });

  it('wraps render failures even without an onError hook', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => {
        throw new Error('boom');
      },
    };
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toMatchObject({ code: 'RENDER' });
  });

  it('throws when the transports tuple is empty', async () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [] as readonly TransportEntry[],
      defaults: { from: 'a@b.com' },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('No transports registered');
  });

  it('wraps non-EmailRpcError provider failures with code PROVIDER', async () => {
    const catalog = createTestCatalog();
    const failingProvider: Transport = {
      name: 'failing',
      send: async () => {
        throw new Error('smtp down');
      },
    };
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'failing', transport: failingProvider, priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toMatchObject({ code: 'PROVIDER', route: 'welcome' });
    expect(errors).toEqual([{ phase: 'send', code: 'PROVIDER' }]);
  });

  it('passes through EmailRpcError thrown by the provider as-is', async () => {
    const catalog = createTestCatalog();
    const original = new EmailRpcError({
      message: 'rate limited',
      code: 'PROVIDER',
    });
    const failingProvider: Transport = {
      name: 'failing',
      send: async () => {
        throw original;
      },
    };
    const mail = createClient({
      catalog,
      transports: [{ name: 'failing', transport: failingProvider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await expect(mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } })).rejects.toBe(
      original,
    );
  });

  it('logs hook errors through structured logger without affecting the failure', async () => {
    const log = memoryLogger();
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
      hooks: {
        onError: () => {
          throw new Error('hook boom');
        },
      },
    });
    await expect(
      mail.welcome.send({
        to: 'lucas@x.com',
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
    const catalog = createTestCatalog();
    const transport = mockTransport();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
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
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('execute abort');
    expect(transport.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('passes through EmailRpcError thrown inside an onError handler without rewrapping', async () => {
    const log = memoryLogger();
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
      hooks: {
        onError: () => {
          throw new EmailRpcError({
            message: 'rpc-handler-err',
            code: 'UNKNOWN',
          });
        },
      },
    });
    await expect(
      mail.welcome.send({
        to: 'lucas@x.com',
        input: { name: 123 as unknown as string },
      }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onError');
  });

  it('wraps a raw error thrown by user middleware as code UNKNOWN with phase middleware', async () => {
    const t = createEmailRpc();
    const breakingMw: Middleware = async () => {
      throw new Error('mw broke');
    };
    const catalog = t.catalog({
      welcome: t
        .use(breakingMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ phase, error }) => {
          errors.push({ phase, code: error.code });
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } }),
    ).rejects.toMatchObject({ code: 'UNKNOWN', route: 'welcome' });
    expect(errors).toEqual([{ phase: 'middleware', code: 'UNKNOWN' }]);
  });

  it('does NOT double-fire onError when an inner hook (onExecute) re-throws and middleware wraps it', async () => {
    const t = createEmailRpc();
    const passthroughMw: Middleware = async ({ next }) => next();
    const catalog = t.catalog({
      welcome: t
        .use(passthroughMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const phases: string[] = [];
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onExecute: () => {
          throw new Error('boom');
        },
        onError: ({ phase }) => {
          phases.push(phase);
        },
      },
    });
    await expect(mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } })).rejects.toThrow(
      'boom',
    );
    expect(phases).toEqual(['hook']);
  });
});

describe('plugin lifecycle (extra)', () => {
  it('continues onClose even if one plugin onClose throws', async () => {
    const order: string[] = [];
    const log = memoryLogger();
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .from({ name: 'Sender', email: 'sender@x.com' })
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
    });
    const result = await mail.welcome.send({
      to: { name: 'Lucas', email: 'lucas@x.com' },
      input: { name: 'Lucas' },
    });
    expect(result.envelope).toEqual({
      from: 'sender@x.com',
      to: ['lucas@x.com'],
    });
  });
});

describe('proxy with symbol keys', () => {
  it('returns undefined for symbol property access', () => {
    const catalog = createTestCatalog();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
    });
    expect((mail as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
  });
});

describe('tags', () => {
  it('serializes definition tags as X-EmailRpc-Tag-* headers', async () => {
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .tags({ tier: 'pro', count: 3, beta: true })
        .template(stubAdapter),
    });
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    const headers = transport.sent[0]!.headers;
    expect(headers['X-EmailRpc-Tag-tier']).toBe('pro');
    expect(headers['X-EmailRpc-Tag-count']).toBe('3');
    expect(headers['X-EmailRpc-Tag-beta']).toBe('true');
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

    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .use(mw1)
        .use(mw2)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });

    expect(calls).toEqual(['mw1 enter', 'mw2 enter', 'mw2 exit', 'mw1 exit']);
  });

  it('short-circuit middleware skips render and provider.send', async () => {
    const transport = mockTransport();
    const shortCircuit: Middleware = async () => ({
      messageId: 'fake',
      accepted: [],
      rejected: ['x@y.com'],
      envelope: { from: 'a@b.com', to: ['x@y.com'] },
      timing: { renderMs: 0, sendMs: 0 },
    });

    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .use(shortCircuit)
        .email()
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
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    const result = await mail.welcome.send({
      to: 'x@y.com',
      input: { name: 'Lucas' },
    });
    expect(result.rejected).toEqual(['x@y.com']);
    expect(transport.sent).toEqual([]);
  });

  it('middleware can mutate ctx visible to downstream middleware', async () => {
    let observed: unknown;
    const setMw: Middleware = async ({ next }) => next({ tenantId: 'acme' });
    const readMw: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };

    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .use(setMw)
        .use(readMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(observed).toMatchObject({ tenantId: 'acme' });
  });
});

describe('integration: full end-to-end', () => {
  it('builds a catalog, creates a client, sends and renders', async () => {
    const t = createEmailRpc();

    const adapter: TemplateAdapter<{ name: string; verifyUrl: string }> = {
      render: async ({ input }) => ({
        html: `<h1>Welcome ${input.name}</h1><a href="${input.verifyUrl}">Verify</a>`,
        text: `Welcome ${input.name}! Verify: ${input.verifyUrl}`,
      }),
    };

    const catalog = t.catalog({
      welcome: t
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
      transports: [{ name: 'mock', transport, priority: 1 }],
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
      to: 'lucas@x.com',
      input: {
        name: 'Lucas',
        verifyUrl: 'https://example.com/verify/abc',
      },
    });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.envelope).toEqual({
      from: 'hello@example.com',
      to: ['lucas@x.com'],
    });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Welcome, Lucas!',
      html: '<h1>Welcome Lucas</h1><a href="https://example.com/verify/abc">Verify</a>',
    });

    expect(hookCalls).toEqual(['before', 'after']);

    const output = await mail.welcome.render({
      name: 'Lucas',
      verifyUrl: 'https://example.com/verify/abc',
    });
    expect(output.html).toContain('Welcome Lucas');
    expect(output.text).toContain('Verify');
  });
});

type LoggerTestOpts = {
  logger?: import('./logger.js').LoggerLike;
  transportThrows?: Error;
  onAfterSend?: () => void;
};

const makeClientForLoggerTests = (opts: LoggerTestOpts) => {
  const t = createEmailRpc();
  const catalog = t.catalog({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .from('a@b.com')
      .template({ render: async () => ({ html: '<p>hi</p>' }) }),
  });
  const transport: Transport = opts.transportThrows
    ? {
        name: 'mock',
        send: async () => {
          throw opts.transportThrows!;
        },
      }
    : mockTransport();
  const client = createClient({
    catalog,
    transports: [{ name: 'mock', transport, priority: 1 }],
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
    const start = log.records.find((r) => r.message === 'send start');
    const ok = log.records.find((r) => r.message === 'send ok');
    expect(start?.level).toBe('debug');
    expect(start?.bindings).toMatchObject({
      component: 'client',
      route: 'welcome',
    });
    expect(start?.bindings.messageId).toEqual(expect.any(String));
    expect(ok?.level).toBe('info');
    expect(ok?.payload).toMatchObject({
      transportName: expect.any(String),
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
    const t = createEmailRpc<{ baseUrl: string }>();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Hi ${input.name}`)
        .template(({ input, ctx }) => ({
          html: `<p>Hi ${input.name} at ${ctx.baseUrl}</p>`,
          text: `Hi ${input.name} at ${ctx.baseUrl}`,
        })),
    });

    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      ctx: { baseUrl: 'example.com' },
      defaults: { from: 'a@b.com' },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      input: { name: 'Lucas' },
    });

    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(transport.sent[0]).toMatchObject({
      html: '<p>Hi Lucas at example.com</p>',
      text: 'Hi Lucas at example.com',
    });
  });

  it('.template() render-function form supports async return', async () => {
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
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
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(transport.sent[0]?.html).toBe('<p>Lucas</p>');
  });

  it('falls back to literal "adapter" name when template has no constructor', async () => {
    const adapterWithoutConstructor: TemplateAdapter<{ name: string }> = Object.assign(
      Object.create(null) as object,
      {
        render: async ({ input }: { input: { name: string } }) => ({
          html: `<p>${input.name}</p>`,
          text: input.name,
        }),
      },
    );
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('Hi')
        .template(adapterWithoutConstructor),
    });

    const log = memoryLogger();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    const renderStart = log.records.find((r) => r.message === 'render start');
    expect(renderStart?.payload.adapter).toBe('adapter');
  });

  it('falls back to literal "adapter" name on render failure when constructor is missing', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = Object.assign(
      Object.create(null) as object,
      {
        render: async () => {
          throw new Error('render boom');
        },
      },
    );
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('Hi')
        .template(failingAdapter),
    });

    const log = memoryLogger();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('Render failed');
    const renderFailed = log.records.find((r) => r.message === 'render failed');
    expect(renderFailed?.payload.adapter).toBe('adapter');
  });

  it('skips undefined entries in the middleware chain', async () => {
    const catalog = createTestCatalog();
    const realMw: Middleware<unknown, unknown, unknown> = async ({ next }) => next();
    const withHoles = [undefined as unknown as Middleware<unknown, unknown, unknown>, realMw];

    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [{ name: 'sparse-mw', middleware: withHoles }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).resolves.toBeDefined();
  });

  it('skips undefined slots in a sparse plugins array on close', async () => {
    const catalog = createTestCatalog();
    type AnyPlugin = NonNullable<Parameters<typeof createClient<typeof catalog, never[]>>[0]['plugins']>[number];
    const sparsePlugins: AnyPlugin[] = [];
    sparsePlugins[1] = {
      name: 'p1',
      onClose: async () => {},
    } as AnyPlugin;

    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: sparsePlugins,
    });

    await expect(mail.close()).resolves.toBeUndefined();
  });
});

describe('kitchen-sink: rate-limit + suppression + idempotency', () => {
  const buildCatalog = (mws: ReadonlyArray<Middleware>) => {
    const t = createEmailRpc();
    let chain: ReturnType<typeof t.email> = t.email();
    for (const mw of mws) chain = chain.use(mw);
    return t.catalog({
      welcome: chain
        .input(z.object({ name: z.string() }))
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(stubAdapter),
    });
  };

  it('chains all three: rate limit OK, not suppressed, fresh — provider sends and idempotency caches', async () => {
    const { withRateLimit } = await import('./middlewares/with-rate-limit.js');
    const { withSuppressionList } = await import('./middlewares/with-suppression-list.js');
    const { withIdempotency } = await import('./middlewares/with-idempotency.js');
    const { inMemoryRateLimitStore } = await import('./stores/in-memory-rate-limit-store.js');
    const { inMemorySuppressionList } = await import('./stores/in-memory-suppression-list.js');
    const { inMemoryIdempotencyStore } = await import('./stores/in-memory-idempotency-store.js');

    const idemStore = inMemoryIdempotencyStore();
    const catalog = buildCatalog([
      withRateLimit({ store: inMemoryRateLimitStore(), key: 'global', max: 10, window: 60_000 }),
      withSuppressionList({ list: inMemorySuppressionList() }),
      withIdempotency({ store: idemStore, key: 'idem-key', ttl: 60_000 }),
    ]);
    const transport = mockTransport();
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    const first = await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(transport.sent).toHaveLength(1);
    const cached = await idemStore.get('idem-key');
    expect(cached?.messageId).toBe(first.messageId);

    const second = await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(second.messageId).toBe(first.messageId);
    expect(transport.sent).toHaveLength(1);
  });

  it('suppression short-circuit does NOT write to idempotency store', async () => {
    const { withSuppressionList } = await import('./middlewares/with-suppression-list.js');
    const { withIdempotency } = await import('./middlewares/with-idempotency.js');
    const { inMemorySuppressionList } = await import('./stores/in-memory-suppression-list.js');
    const { inMemoryIdempotencyStore } = await import('./stores/in-memory-idempotency-store.js');

    const list = inMemorySuppressionList();
    await list.set('blocked@x.com', { reason: 'unsubscribe', createdAt: new Date() });
    const idemStore = inMemoryIdempotencyStore();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const catalog = buildCatalog([
        withSuppressionList({ list }),
        withIdempotency({ store: idemStore, key: 'idem-key', ttl: 60_000 }),
      ]);
      const transport = mockTransport();
      const mail = createClient({
        catalog,
        transports: [{ name: 'mock', transport, priority: 1 }],
        defaults: { from: 'a@b.com' },
      });

      const result = await mail.welcome.send({
        to: 'blocked@x.com',
        input: { name: 'Lucas' },
      });
      expect(result.messageId).toBe('suppressed');
      expect(transport.sent).toHaveLength(0);
      expect(await idemStore.get('idem-key')).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rate-limit throw does NOT write to idempotency store', async () => {
    const { withRateLimit } = await import('./middlewares/with-rate-limit.js');
    const { withIdempotency } = await import('./middlewares/with-idempotency.js');
    const { inMemoryRateLimitStore } = await import('./stores/in-memory-rate-limit-store.js');
    const { inMemoryIdempotencyStore } = await import('./stores/in-memory-idempotency-store.js');
    const { EmailRpcRateLimitedError } = await import('./errors.js');

    const idemStore = inMemoryIdempotencyStore();
    const catalog = buildCatalog([
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
      transports: [{ name: 'mock', transport, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'a@x.com', input: { name: 'Lucas' } });
    expect(transport.sent).toHaveLength(1);
    const cachedAfterFirst = await idemStore.get('idem-key');
    expect(cachedAfterFirst).not.toBeNull();

    await idemStore.set(
      'idem-key',
      { ...cachedAfterFirst!, messageId: 'sentinel' },
      60_000,
    );

    await expect(
      mail.welcome.send({ to: 'b@x.com', input: { name: 'Lucas' } }),
    ).rejects.toBeInstanceOf(EmailRpcRateLimitedError);
    expect(transport.sent).toHaveLength(1);
    expect((await idemStore.get('idem-key'))?.messageId).toBe('sentinel');
  });
});
