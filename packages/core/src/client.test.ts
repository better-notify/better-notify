import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { emailRpc } from './index.js';
import { createClient } from './client.js';
import { mockProvider } from './test.js';
import type { RenderedOutput } from './template.js';
import type { TemplateAdapter } from './template.js';
import type { ProviderEntry, SendOptions } from './client.js';
import type { Provider } from './provider.js';

const stubAdapter: TemplateAdapter<{ to: string; name: string }> = {
  render: async (input) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

function createTestRouter() {
  const t = emailRpc.init();
  return t.router({
    welcome: t
      .email('welcome')
      .input(z.object({ to: z.string().email(), name: z.string() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter),
  });
}

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

    const output = await mail.welcome.render({ to: 'lucas@x.com', name: 'Lucas' });
    expect(output.html).toBe('<p>Hello Lucas</p>');
    expect(output.text).toBe('Hello Lucas');
  });

  it('returns html string when format is html', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const html = await mail.welcome.render(
      { to: 'lucas@x.com', name: 'Lucas' },
      { format: 'html' },
    );
    expect(html).toBe('<p>Hello Lucas</p>');
  });

  it('returns empty string when format is text and adapter has no text', async () => {
    const noTextAdapter: TemplateAdapter<{ to: string; name: string }> = {
      render: async () => ({ html: '<p>hi</p>' }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email('welcome')
        .input(z.object({ to: z.string().email(), name: z.string() }))
        .subject('Hi')
        .template(noTextAdapter),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const text = await mail.welcome.render(
      { to: 'lucas@x.com', name: 'Lucas' },
      { format: 'text' },
    );
    expect(text).toBe('');
  });

  it('throws EmailRpcValidationError for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.render({ to: 'not-an-email', name: 'Lucas' }),
    ).rejects.toThrow('Validation failed');
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

    const result = await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });

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

    const result = await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(result.envelope.from).toBe('default@example.com');
  });

  it('uses adapter subject over definition subject when adapter returns one', async () => {
    const adapterWithSubject: TemplateAdapter<{ to: string; name: string }> = {
      render: async () => ({
        html: '<p>hi</p>',
        subject: 'From Adapter',
      }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email('welcome')
        .input(z.object({ to: z.string().email(), name: z.string() }))
        .subject('From Definition')
        .template(adapterWithSubject),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(provider.sent[0]!.subject).toBe('From Adapter');
  });

  it('throws validation error for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'bad', name: 'Lucas' }),
    ).rejects.toThrow('Validation failed');
  });

  it('throws when no from address is available', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' }),
    ).rejects.toThrow('from');
  });
});
