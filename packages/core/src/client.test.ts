import { describe, expect, it, expectTypeOf, vi } from 'vitest';
import { z } from 'zod';
import { emailRpc } from './index.js';
import { createClient } from './client.js';
import { mockProvider, memoryLogger } from './test.js';
import { EmailRpcError } from './errors.js';
import type { TemplateAdapter } from './template.js';
import type { ProviderEntry, SendOptions } from './client.js';
import type { Provider } from './provider.js';
import type { Middleware } from './middleware.js';

const stubAdapter: TemplateAdapter<{ name: string }> = {
  render: async (input) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

const createTestRouter = () => {
  const t = emailRpc.init();
  return t.router({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter),
  });
};

describe('client types', () => {
  it('SendOptions infers provider names from the providers tuple', () => {
    type Entries = readonly [
      { name: 'ses'; provider: Provider; priority: 1 },
      { name: 'smtp'; provider: Provider; priority: 2 },
    ];
    type Opts = SendOptions<Entries>;
    expectTypeOf<Opts['provider']>().toEqualTypeOf<'ses' | 'smtp' | undefined>();
  });

  it('ProviderEntry has correct shape', () => {
    expectTypeOf<ProviderEntry>().toMatchTypeOf<{
      name: string;
      provider: Provider;
      priority: number;
    }>();
  });
});

describe('executeRender', () => {
  it('validates and renders a route', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const output = await mail.welcome.render({ name: 'Lucas' });
    expect(output.html).toBe('<p>Hello Lucas</p>');
    expect(output.text).toBe('Hello Lucas');
  });

  it('returns html string when format is html', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const html = await mail.welcome.render({ name: 'Lucas' }, { format: 'html' });
    expect(html).toBe('<p>Hello Lucas</p>');
  });

  it('returns empty string when format is text and adapter has no text', async () => {
    const noTextAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '<p>hi</p>' }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('Hi')
        .template(noTextAdapter),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const text = await mail.welcome.render({ name: 'Lucas' }, { format: 'text' });
    expect(text).toBe('');
  });

  it('throws EmailRpcValidationError for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(mail.welcome.render({ name: 123 as unknown as string })).rejects.toThrow(
      'Validation failed',
    );
  });
});

describe('executeSend', () => {
  it('validates, renders, and sends through the default provider', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'hello@example.com' },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      input: { name: 'Lucas' },
    });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.rejected).toEqual([]);
    expect(result.envelope).toEqual({ from: 'hello@example.com', to: ['lucas@x.com'] });
    expect(result.timing.renderMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.sendMs).toBeGreaterThanOrEqual(0);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Welcome, Lucas!',
      html: '<p>Hello Lucas</p>',
    });
  });

  it('uses defaults.from when contract has no from', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
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
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('From Definition')
        .template(adapterWithSubject),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(provider.sent[0]!.subject).toBe('From Adapter');
  });

  it('throws validation error for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 123 as unknown as string } }),
    ).rejects.toThrow('Validation failed');
  });

  it('throws when no from address is available', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('from');
  });

  it('accepts an array of recipients', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    const result = await mail.welcome.send({
      to: ['a@x.com', 'b@x.com'],
      input: { name: 'Lucas' },
    });
    expect(result.envelope.to).toEqual(['a@x.com', 'b@x.com']);
  });

  it('forwards cc, bcc, replyTo, headers, and attachments to the provider', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
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

    const sent = provider.sent[0]!;
    expect(sent.cc).toEqual(['team@x.com']);
    expect(sent.bcc).toEqual(['legal@x.com', 'audit@x.com']);
    expect(sent.replyTo).toBe('support+ticket-42@x.com');
    expect(sent.headers['X-Default']).toBe('1');
    expect(sent.headers['X-Custom']).toBe('yes');
    expect(sent.attachments).toBe(1);
  });

  it('per-send replyTo overrides def and defaults', async () => {
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .replyTo('def@x.com')
        .subject('s')
        .template(stubAdapter),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com', replyTo: 'defaults@x.com' },
    });

    await mail.welcome.send({
      to: 'lucas@x.com',
      replyTo: 'override@x.com',
      input: { name: 'Lucas' },
    });
    expect(provider.sent[0]!.replyTo).toBe('override@x.com');
  });

  it('per-send headers override default headers on key collision', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com', headers: { 'X-Source': 'default' } },
    });

    await mail.welcome.send({
      to: 'lucas@x.com',
      headers: { 'X-Source': 'send' },
      input: { name: 'Lucas' },
    });
    expect(provider.sent[0]!.headers['X-Source']).toBe('send');
  });
});

describe('provider selection', () => {
  it('uses the lowest-priority provider by default', async () => {
    const router = createTestRouter();
    const primary = mockProvider();
    const secondary = mockProvider();
    const mail = createClient({
      router,
      providers: [
        { name: 'secondary', provider: secondary, priority: 2 },
        { name: 'primary', provider: primary, priority: 1 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(primary.sent).toHaveLength(1);
    expect(secondary.sent).toHaveLength(0);
  });

  it('overrides to a named provider', async () => {
    const router = createTestRouter();
    const primary = mockProvider();
    const secondary = mockProvider();
    const mail = createClient({
      router,
      providers: [
        { name: 'primary', provider: primary, priority: 1 },
        { name: 'secondary', provider: secondary, priority: 2 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send(
      { to: 'lucas@x.com', input: { name: 'Lucas' } },
      { provider: 'secondary' },
    );
    expect(primary.sent).toHaveLength(0);
    expect(secondary.sent).toHaveLength(1);
  });

  it('throws for unknown provider name', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await expect(
      mail.welcome.send(
        { to: 'lucas@x.com', input: { name: 'Lucas' } },
        { provider: 'nonexistent' as never },
      ),
    ).rejects.toThrow('not registered');
  });
});

describe('client hooks', () => {
  it('fires onBeforeSend and onAfterSend', async () => {
    const router = createTestRouter();
    const calls: string[] = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const router = createTestRouter();
    const errors: Array<{ phase: string; route: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ route, phase }) => {
          errors.push({ route, phase });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 123 as unknown as string } }),
    ).rejects.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ route: 'welcome', phase: 'validate' });
  });

  it('hook errors do not affect the send result', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onAfterSend: () => {
          throw new Error('hook boom');
        },
      },
    });

    const result = await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    expect(result.accepted).toEqual(['lucas@x.com']);
  });

  it('fires onExecute with the rendered message', async () => {
    const router = createTestRouter();
    let captured: { subject: string; html: string } | undefined;
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const router = createTestRouter();
    const provider = mockProvider();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
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
    expect(provider.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('multi-hook registration runs all in order', async () => {
    const router = createTestRouter();
    const calls: string[] = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const router = createTestRouter();
    const calls: string[] = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [
        { name: 'ses', provider: mockProvider(), priority: 1 },
        { name: 'smtp', provider: mockProvider(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send).parameter(0).toMatchTypeOf<{
      to:
        | string
        | { name?: string; address: string }
        | Array<string | { name?: string; address: string }>;
      input: { name: string };
    }>();

    expectTypeOf(mail.welcome.render).parameter(0).toMatchTypeOf<{ name: string }>();
  });

  it('send options autocomplete provider names', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [
        { name: 'ses', provider: mockProvider(), priority: 1 },
        { name: 'smtp', provider: mockProvider(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send)
      .parameter(1)
      .toMatchTypeOf<{ provider?: 'ses' | 'smtp' } | undefined>();
  });
});

describe('proxy behavior', () => {
  it('caches route methods — same object on repeated access', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const a = mail.welcome;
    const b = mail.welcome;
    expect(a).toBe(b);
  });

  it('returns undefined for routes not in the router', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    expect((mail as never as Record<string, unknown>).nonexistent).toBeUndefined();
  });

  it('route methods are frozen', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const errors: Array<{ phase: string; route: string; code: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ route, phase, error }) => {
          errors.push({ route, phase, code: error.code });
        },
      },
    });

    await expect(mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } })).rejects
      .toMatchObject({ code: 'RENDER', route: 'welcome' });
    expect(errors).toEqual([{ route: 'welcome', phase: 'render', code: 'RENDER' }]);
  });

  it('wraps render failures even without an onError hook', async () => {
    const failingAdapter: TemplateAdapter<{ name: string }> = {
      render: async () => {
        throw new Error('boom');
      },
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(failingAdapter),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toMatchObject({ code: 'RENDER' });
  });

  it('throws when the providers tuple is empty', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [] as readonly ProviderEntry[],
      defaults: { from: 'a@b.com' },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('No providers registered');
  });

  it('wraps non-EmailRpcError provider failures with code PROVIDER', async () => {
    const router = createTestRouter();
    const failingProvider: Provider = {
      name: 'failing',
      send: async () => {
        throw new Error('smtp down');
      },
    };
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'failing', provider: failingProvider, priority: 1 }],
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
    const router = createTestRouter();
    const original = new EmailRpcError({ message: 'rate limited', code: 'PROVIDER' });
    const failingProvider: Provider = {
      name: 'failing',
      send: async () => {
        throw original;
      },
    };
    const mail = createClient({
      router,
      providers: [{ name: 'failing', provider: failingProvider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
    ).rejects.toBe(original);
  });

  it('logs hook errors through structured logger without affecting the failure', async () => {
    const log = memoryLogger();
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
      hooks: {
        onError: () => {
          throw new Error('hook boom');
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 123 as unknown as string } }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onError');
  });
});

describe('error pipeline (extra)', () => {
  it('throw in onExecute aborts the send and re-emits via onError(phase: hook)', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const errors: Array<{ phase: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
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
    expect(provider.sent).toEqual([]);
    expect(errors).toEqual([{ phase: 'hook' }]);
  });

  it('passes through EmailRpcError thrown inside an onError handler without rewrapping', async () => {
    const log = memoryLogger();
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
      hooks: {
        onError: () => {
          throw new EmailRpcError({ message: 'rpc-handler-err', code: 'UNKNOWN' });
        },
      },
    });
    await expect(
      mail.welcome.send({ to: 'lucas@x.com', input: { name: 123 as unknown as string } }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'hook failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.hook).toBe('onError');
  });

  it('wraps a raw error thrown by user middleware as code UNKNOWN with phase middleware', async () => {
    const t = emailRpc.init();
    const breakingMw: Middleware = async () => {
      throw new Error('mw broke');
    };
    const router = t.router({
      welcome: t
        .use(breakingMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const errors: Array<{ phase: string; code: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    const t = emailRpc.init();
    const passthroughMw: Middleware = async ({ next }) => next();
    const router = t.router({
      welcome: t
        .use(passthroughMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const phases: string[] = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
    await expect(
      mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } }),
    ).rejects.toThrow('boom');
    expect(phases).toEqual(['hook']);
  });
});

describe('plugin lifecycle (extra)', () => {
  it('continues onClose even if one plugin onClose throws', async () => {
    const order: string[] = [];
    const log = memoryLogger();
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      logger: log,
      plugins: [
        { name: 'a', onClose: () => { order.push('a'); } },
        { name: 'b', onClose: () => { throw new Error('close boom'); } },
        { name: 'c', onClose: () => { order.push('c'); } },
      ],
    });
    await mail.close();
    expect(order).toEqual(['c', 'a']);
    const rec = log.records.find((r) => r.message === 'plugin close failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.plugin).toBe('b');
  });
});

describe('handlePromise', () => {
  it('wraps non-Error rejections into an Error instance', async () => {
    const { handlePromise } = await import('./client.js');
    const [value, err] = await handlePromise(Promise.reject('plain string'));
    expect(value).toBeNull();
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toBe('plain string');
  });
});

describe('address normalization', () => {
  it('normalizes Address objects on from and to into envelope strings', async () => {
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .from({ name: 'Sender', address: 'sender@x.com' })
        .template(stubAdapter),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
    });
    const result = await mail.welcome.send({
      to: { name: 'Lucas', address: 'lucas@x.com' },
      input: { name: 'Lucas' },
    });
    expect(result.envelope).toEqual({ from: 'sender@x.com', to: ['lucas@x.com'] });
  });
});

describe('proxy with symbol keys', () => {
  it('returns undefined for symbol property access', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });
    expect((mail as unknown as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
  });
});

describe('tags', () => {
  it('serializes definition tags as X-EmailRpc-Tag-* headers', async () => {
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .tags({ tier: 'pro', count: 3, beta: true })
        .template(stubAdapter),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
    const headers = provider.sent[0]!.headers;
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

    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(mw1)
        .use(mw2)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });

    expect(calls).toEqual(['mw1 enter', 'mw2 enter', 'mw2 exit', 'mw1 exit']);
  });

  it('short-circuit middleware skips render and provider.send', async () => {
    const provider = mockProvider();
    const shortCircuit: Middleware = async () => ({
      messageId: 'fake',
      accepted: [],
      rejected: ['x@y.com'],
      envelope: { from: 'a@b.com', to: ['x@y.com'] },
      timing: { renderMs: 0, sendMs: 0 },
    });

    const t = emailRpc.init();
    const router = t.router({
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
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    const result = await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(result.rejected).toEqual(['x@y.com']);
    expect(provider.sent).toEqual([]);
  });

  it('middleware can mutate ctx visible to downstream middleware', async () => {
    let observed: unknown;
    const setMw: Middleware = async ({ next }) => next({ tenantId: 'acme' });
    const readMw: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };

    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(setMw)
        .use(readMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(observed).toMatchObject({ tenantId: 'acme' });
  });
});

describe('integration: full end-to-end', () => {
  it('builds a router, creates a client, sends and renders', async () => {
    const t = emailRpc.init();

    const adapter: TemplateAdapter<{ name: string; verifyUrl: string }> = {
      render: async (input) => ({
        html: `<h1>Welcome ${input.name}</h1><a href="${input.verifyUrl}">Verify</a>`,
        text: `Welcome ${input.name}! Verify: ${input.verifyUrl}`,
      }),
    };

    const router = t.router({
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

    const provider = mockProvider();
    const hookCalls: string[] = [];

    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
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

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
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
  providerThrows?: Error;
  onAfterSend?: () => void;
};

const makeClientForLoggerTests = (opts: LoggerTestOpts) => {
  const t = emailRpc.init();
  const router = t.router({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .from('a@b.com')
      .template({ render: async () => ({ html: '<p>hi</p>' }) }),
  });
  const provider: Provider = opts.providerThrows
    ? {
        name: 'mock',
        send: async () => {
          throw opts.providerThrows!;
        },
      }
    : mockProvider();
  const client = createClient({
    router,
    providers: [{ name: 'mock', provider, priority: 1 }],
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
    expect(start?.bindings).toMatchObject({ component: 'client', route: 'welcome' });
    expect(start?.bindings.messageId).toEqual(expect.any(String));
    expect(ok?.level).toBe('info');
    expect(ok?.payload).toMatchObject({
      providerName: expect.any(String),
      durationMs: expect.any(Number),
    });
  });

  it('logs validate failed at warn with err', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({ logger: log });
    await expect(
      client.welcome.send({ to: 'a@b.com', input: { name: 123 as unknown as string } }),
    ).rejects.toThrow();
    const rec = log.records.find((r) => r.message === 'validate failed');
    expect(rec?.level).toBe('warn');
    expect(rec?.payload.err).toBeInstanceOf(Error);
  });

  it('logs send failed at error with err and durationMs when provider rejects', async () => {
    const log = memoryLogger();
    const { client } = makeClientForLoggerTests({
      logger: log,
      providerThrows: new Error('smtp down'),
    });
    await expect(
      client.welcome.send({ to: 'a@b.com', input: { name: 'x' } }),
    ).rejects.toThrow();
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

    const { client: bad } = makeClientForLoggerTests({ providerThrows: new Error('x') });
    await expect(
      bad.welcome.send({ to: 'a@b.com', input: { name: 'x' } }),
    ).rejects.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
