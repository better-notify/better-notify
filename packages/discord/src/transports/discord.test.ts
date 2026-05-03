import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import type { RenderedDiscord } from '../types.js';
import type { SendContext } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc-token';

const baseMessage: RenderedDiscord = {
  body: 'Hello Discord!',
};

const ctx: SendContext = { route: 'alerts.deploy', messageId: 'msg-1', attempt: 1 };

const mockFetchNoContent = () => fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

const mockFetchWithMessage = (id = '1234567890') =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id }), { status: 200 }));

describe('discordTransport', () => {
  it('POSTs to the webhook URL with correct body', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseMessage, ctx);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(WEBHOOK_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ content: 'Hello Discord!' });
  });

  it('maps body to content and embeds to embeds', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const embeds = [{ title: 'Deploy', description: 'v2.0', color: 0x00ff00 }];
    await t.send({ ...baseMessage, embeds }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.content).toBe('Hello Discord!');
    expect(body.embeds).toEqual(embeds);
  });

  it('channel username/avatarUrl override transport defaults', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({
      webhookUrl: WEBHOOK_URL,
      username: 'Default Bot',
      avatarUrl: 'https://default.png',
    });
    await t.send(
      { ...baseMessage, username: 'Channel Bot', avatarUrl: 'https://channel.png' },
      ctx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.username).toBe('Channel Bot');
    expect(body.avatar_url).toBe('https://channel.png');
  });

  it('uses transport defaults when channel slots are absent', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({
      webhookUrl: WEBHOOK_URL,
      username: 'Default Bot',
      avatarUrl: 'https://default.png',
    });
    await t.send(baseMessage, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.username).toBe('Default Bot');
    expect(body.avatar_url).toBe('https://default.png');
  });

  it('omits username/avatar_url when neither channel nor transport provides them', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseMessage, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.username).toBeUndefined();
    expect(body.avatar_url).toBeUndefined();
  });

  it('appends ?wait=true when opted in', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchWithMessage();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL, wait: true });
    await t.send(baseMessage, ctx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${WEBHOOK_URL}?wait=true`);
  });

  it('returns transportMessageId from wait=true response', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchWithMessage('9876543210');
    const t = discordTransport({ webhookUrl: WEBHOOK_URL, wait: true });
    const result = await t.send(baseMessage, ctx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('9876543210');
    expect(result.data.raw).toMatchObject({ id: '9876543210' });
  });

  it('returns undefined transportMessageId for wait=false (204)', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBeUndefined();
    expect(result.data.raw).toEqual({});
  });

  it('has name "discord"', async () => {
    const { discordTransport } = await import('./discord.js');
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    expect(t.name).toBe('discord');
  });
});

describe('discordTransport — error mapping', () => {
  it('returns VALIDATION for 400 status', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid Form Body', code: 50035 }), { status: 400 }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcError);
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('returns CONFIG for 401 status', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 0 }), { status: 401 }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns CONFIG for 403 status', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden', code: 0 }), { status: 403 }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns CONFIG for 404 status (webhook deleted)', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unknown Webhook', code: 10015 }), { status: 404 }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns PROVIDER for 429 rate limit with retry-after', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'You are being rate limited.', retry_after: 1.5 }), {
        status: 429,
        headers: { 'Retry-After': '2' },
      }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('retry after');
  });

  it('returns PROVIDER for 500 server error', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Internal Server Error', code: 0 }), { status: 500 }),
    );
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('falls back to HTTP status when error response has no message', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 502 }));
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 502');
  });
});

describe('discordTransport — attachments', () => {
  it('sends multipart/form-data when attachments are present', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('pdf-bytes'),
            contentType: 'application/pdf',
          },
        ],
      },
      ctx,
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    const payloadJson = JSON.parse(form.get('payload_json') as string);
    expect(payloadJson.content).toBe('Hello Discord!');
    expect(payloadJson.attachments).toEqual([{ id: 0, filename: 'test.pdf' }]);
    expect(form.get('files[0]')).toBeInstanceOf(Blob);
  });

  it('includes attachment description when provided', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          { filename: 'report.pdf', content: Buffer.from('data'), description: 'Monthly report' },
        ],
      },
      ctx,
    );

    const form = fetchMock.mock.calls[0]![1].body as FormData;
    const payloadJson = JSON.parse(form.get('payload_json') as string);
    expect(payloadJson.attachments[0].description).toBe('Monthly report');
  });

  it('sends multiple files with indexed form fields', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          { filename: 'a.txt', content: 'hello' },
          { filename: 'b.txt', content: 'world' },
        ],
      },
      ctx,
    );

    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(form.get('files[0]')).toBeInstanceOf(Blob);
    expect(form.get('files[1]')).toBeInstanceOf(Blob);
    const payloadJson = JSON.parse(form.get('payload_json') as string);
    expect(payloadJson.attachments).toHaveLength(2);
  });

  it('does not set Content-Type header for multipart (let fetch set boundary)', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'f.txt', content: 'x' }],
      },
      ctx,
    );

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers).toBeUndefined();
  });

  it('uses JSON when attachments array is empty', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseMessage, attachments: [] }, ctx);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(typeof init.body).toBe('string');
  });

  it('converts string content to Buffer', async () => {
    const { discordTransport } = await import('./discord.js');
    mockFetchNoContent();
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'note.txt', content: 'hello world', contentType: 'text/plain' }],
      },
      ctx,
    );

    const form = fetchMock.mock.calls[0]![1].body as FormData;
    const file = form.get('files[0]') as Blob;
    expect(file.type).toBe('text/plain');
    expect(file.size).toBe(Buffer.from('hello world').length);
  });
});

describe('discordTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('network error');
  });

  it('returns TIMEOUT when fetch throws TimeoutError', async () => {
    const { discordTransport } = await import('./discord.js');
    const err = new DOMException('signal timed out', 'TimeoutError');
    fetchMock.mockRejectedValue(err);
    const t = discordTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('TIMEOUT');
    expect(result.error.message).toContain('request timed out');
  });

  it('returns PROVIDER when response body is not valid JSON (wait=true)', async () => {
    const { discordTransport } = await import('./discord.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = discordTransport({ webhookUrl: WEBHOOK_URL, wait: true });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });
});
