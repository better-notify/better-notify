import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedMessage } from '@betternotify/email';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

const baseMessage: RenderedMessage = {
  from: { name: 'App', email: 'noreply@example.com' },
  to: [{ email: 'user@example.com' }],
  subject: 'Hello',
  html: '<p>hi</p>',
  text: 'hi',
};

const baseCtx: SendContext = { route: 'welcome', messageId: 'm1', attempt: 1 };

const okResponse = { id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' };

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('resendTransport', () => {
  it('sends a POST to the Resend API with correct URL and auth header', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe('Bearer re_test_123');
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe('application/json');
  });

  it('maps RenderedMessage fields to the Resend request body', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      {
        ...baseMessage,
        cc: [{ name: 'CC User', email: 'cc@example.com' }],
        bcc: ['bcc@example.com'],
        replyTo: { name: 'Reply', email: 'reply@example.com' },
        headers: { 'X-Campaign': 'launch' },
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toBe('"App" <noreply@example.com>');
    expect(body.to).toEqual(['user@example.com']);
    expect(body.cc).toEqual(['"CC User" <cc@example.com>']);
    expect(body.bcc).toEqual(['bcc@example.com']);
    expect(body.reply_to).toEqual(['"Reply" <reply@example.com>']);
    expect(body.subject).toBe('Hello');
    expect(body.html).toBe('<p>hi</p>');
    expect(body.text).toBe('hi');
    expect(body.headers).toEqual({ 'X-Campaign': 'launch' });
  });

  it('returns EmailTransportData with transportMessageId from Resend response', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('49a3999c-0ce1-4ea6-ab68-afcd6dc2e794');
    expect(result.data.accepted).toEqual(['user@example.com']);
    expect(result.data.rejected).toEqual([]);
    expect(result.data.raw).toMatchObject({ id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' });
  });

  it('uses custom baseUrl when provided', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123', baseUrl: 'https://mock.local' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/emails');
  });

  it('omits optional fields from request body when not in RenderedMessage', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
    expect(body.text).toBeUndefined();
    expect(body.attachments).toBeUndefined();
    expect(body.headers).toBeUndefined();
    expect(body.tags).toBeUndefined();
  });

  it('has name "resend"', async () => {
    const { resendTransport } = await import('./index.js');
    const t = resendTransport({ apiKey: 're_test_123' });
    expect(t.name).toBe('resend');
  });

  it('maps string from address directly', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toBe('plain@example.com');
  });

  it('maps tags from Record to array of { name, value } pairs', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      { ...baseMessage, tags: { campaign: 'launch', version: 2, active: true } },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.tags).toEqual([
      { name: 'campaign', value: 'launch' },
      { name: 'version', value: '2' },
      { name: 'active', value: 'true' },
    ]);
  });

  it('drops unsupported fields (priority, inlineAssets) without error', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(
      {
        ...baseMessage,
        priority: 'high',
        inlineAssets: { logo: { path: '/logo.png' } },
      },
      baseCtx,
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.priority).toBeUndefined();
    expect(body.inlineAssets).toBeUndefined();
  });

  it('populates accepted from all to recipients', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(
      {
        ...baseMessage,
        to: [{ email: 'a@x.com' }, { email: 'b@x.com' }, 'c@x.com'],
      },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });
});

describe('resendTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { resendTransport } = await import('./index.js');
    const t = resendTransport({ apiKey: 're_test_123' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('resendTransport — Resend API errors', () => {
  it('returns VALIDATION for 422 status', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 422,
          message: 'Missing `to` field.',
          name: 'missing_required_field',
        }),
        { status: 422 },
      ),
    );
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcError);
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
    expect(result.error.message).toContain('missing_required_field');
  });

  it('returns CONFIG for 401 status', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 401,
          message: 'Missing API key in the authorization header.',
          name: 'missing_api_key',
        }),
        { status: 401 },
      ),
    );
    const t = resendTransport({ apiKey: '' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns CONFIG for 403 status', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: 'API key is invalid.',
          name: 'invalid_api_key',
        }),
        { status: 403 },
      ),
    );
    const t = resendTransport({ apiKey: 're_bad_key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns PROVIDER for 429 rate limit', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 429,
          message: 'Too many requests.',
          name: 'rate_limit_exceeded',
        }),
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('returns PROVIDER for 500 server error', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 500,
          message: 'Internal server error.',
          name: 'internal_server_error',
        }),
        { status: 500 },
      ),
    );
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('includes error name and message in the error string', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          statusCode: 422,
          message: 'Invalid `from` field.',
          name: 'invalid_from_address',
        }),
        { status: 422 },
      ),
    );
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('invalid_from_address');
    expect(result.error.message).toContain('Invalid `from` field.');
  });
});

describe('resendTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('network error');
  });

  it('returns TIMEOUT when fetch throws TimeoutError', async () => {
    const { resendTransport } = await import('./index.js');
    const err = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(err);
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('TIMEOUT');
    expect(result.error.message).toContain('request timed out');
  });

  it('returns PROVIDER when response body is not valid JSON', async () => {
    const { resendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = resendTransport({ apiKey: 're_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });
});

describe('resendTransport — attachments', () => {
  it('base64-encodes Buffer attachment content', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'invoice.pdf',
            content: Buffer.from('pdf-bytes'),
            contentType: 'application/pdf',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments).toEqual([
      {
        content: Buffer.from('pdf-bytes').toString('base64'),
        filename: 'invoice.pdf',
        content_type: 'application/pdf',
      },
    ]);
  });

  it('base64-encodes string attachment content', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'note.txt',
            content: 'hello world',
            contentType: 'text/plain',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].content).toBe(Buffer.from('hello world').toString('base64'));
  });

  it('maps cid to content_id', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'logo.png',
            content: Buffer.from('png-bytes'),
            contentType: 'image/png',
            cid: 'logo@inline',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].content_id).toBe('logo@inline');
  });

  it('omits content_type when not provided', async () => {
    const { resendTransport } = await import('./index.js');
    mockFetchOk();
    const t = resendTransport({ apiKey: 're_test_123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'data.bin', content: Buffer.from('bytes') }],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].content_type).toBeUndefined();
  });
});

describe('resendAdapter (stub)', () => {
  it('throws not-implemented', async () => {
    const { resendAdapter } = await import('./index.js');
    expect(() => resendAdapter()).toThrow(/not implemented/);
  });
});
