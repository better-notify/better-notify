import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import type { SendContext } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/123/abc';

const baseMessage = {
  from: { name: 'Acme', email: 'hello@acme.com' },
  to: [{ name: 'John', email: 'john@example.com' }],
  subject: 'Order confirmed',
  html: '<h1>Hello</h1>',
  text: 'Hello',
};

const ctx: SendContext = { route: 'orders.confirmed', messageId: 'msg-1', attempt: 1 };

describe('zapierTransport', () => {
  it('POSTs email payload with type "email"', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseMessage, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.type).toBe('email');
    expect(body.route).toBe('orders.confirmed');
    expect(body.messageId).toBe('msg-1');
    expect(body.timestamp).toBeDefined();
  });

  it('normalizes from address to { name, email } object', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseMessage, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ name: 'Acme', email: 'hello@acme.com' });
  });

  it('normalizes string-only from address', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ email: 'plain@example.com' });
  });

  it('normalizes to addresses to objects', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseMessage, to: ['a@b.com', { name: 'Bob', email: 'bob@b.com' }] }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toEqual([{ email: 'a@b.com' }, { name: 'Bob', email: 'bob@b.com' }]);
  });

  it('includes subject, html, text', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseMessage, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.subject).toBe('Order confirmed');
    expect(body.html).toBe('<h1>Hello</h1>');
    expect(body.text).toBe('Hello');
  });

  it('returns ok with accepted addresses on success', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['john@example.com']);
    expect(result.data.rejected).toEqual([]);
  });

  it('returns CONFIG error when from is missing', async () => {
    const { zapierTransport } = await import('./zapier.js');
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send({ ...baseMessage, from: undefined }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns VALIDATION error when to is empty', async () => {
    const { zapierTransport } = await import('./zapier.js');
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send({ ...baseMessage, to: [] }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('includes attachments as base64', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'doc.pdf', content: Buffer.from('pdf-data'), contentType: 'application/pdf' }],
      },
      ctx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments).toEqual([
      { filename: 'doc.pdf', content: Buffer.from('pdf-data').toString('base64'), contentType: 'application/pdf' },
    ]);
  });

  it('throws CONFIG at construction for invalid URL', async () => {
    const { zapierTransport } = await import('./zapier.js');
    expect(() => zapierTransport({ webhookUrl: 'not-valid' })).toThrow(NotifyRpcError);
  });

  it('includes replyTo when present', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseMessage, replyTo: { name: 'Support', email: 'support@acme.com' } }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.replyTo).toEqual({ name: 'Support', email: 'support@acme.com' });
  });

  it('sets text to null when not provided', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    const { text: _text, ...noText } = baseMessage;
    await t.send(noText, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.text).toBeNull();
  });

  it('returns PROVIDER error on network failure', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('handles string attachment content without base64 encoding', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'note.txt', content: 'plain string content' }],
      },
      ctx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments).toEqual([{ filename: 'note.txt', content: 'plain string content' }]);
  });

  it('normalizes address without name to just { email }', async () => {
    const { zapierTransport } = await import('./zapier.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseMessage, from: { email: 'no-name@test.com' } }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ email: 'no-name@test.com' });
  });

  it('has name "zapier"', async () => {
    const { zapierTransport } = await import('./zapier.js');
    const t = zapierTransport({ webhookUrl: WEBHOOK_URL });
    expect(t.name).toBe('zapier');
  });
});
