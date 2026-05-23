import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedMessage } from '@betternotify/email';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcProviderError } from '@betternotify/core';

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

const okResponse = {
  success: true,
  data: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    from: 'noreply@example.com',
    to: ['user@example.com'],
    status: 'queued',
    created_at: '2026-05-23T12:00:00Z',
  },
};

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('unosendTransport', () => {
  it('sends a POST to the Unosend API with correct URL and auth header', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.unosend.co/emails');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe(
      'Bearer un_test_123',
    );
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('maps RenderedMessage fields to the Unosend request body', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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
    expect(body.reply_to).toBe('"Reply" <reply@example.com>');
    expect(body.subject).toBe('Hello');
    expect(body.html).toBe('<p>hi</p>');
    expect(body.text).toBe('hi');
    expect(body.headers).toEqual({ 'X-Campaign': 'launch' });
  });

  it('returns EmailTransportData with transportMessageId from Unosend response', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.data.accepted).toEqual(['user@example.com']);
    expect(result.data.rejected).toEqual([]);
    expect(result.data.raw).toMatchObject(okResponse);
  });

  it('uses custom baseUrl when provided', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123', baseUrl: 'https://mock.local' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/emails');
  });

  it('omits optional fields from request body when not in RenderedMessage', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
    expect(body.text).toBeUndefined();
    expect(body.attachments).toBeUndefined();
    expect(body.headers).toBeUndefined();
    expect(body.tags).toBeUndefined();
    expect(body.priority).toBeUndefined();
    expect(body.scheduled_for).toBeUndefined();
    expect(body.tracking).toBeUndefined();
  });

  it('has name "unosend"', async () => {
    const { unosendTransport } = await import('./index.js');
    const t = unosendTransport({ apiKey: 'un_test_123' });
    expect(t.name).toBe('unosend');
  });

  it('maps string from address directly', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toBe('plain@example.com');
  });

  it('maps tags from Record to array of { name, value } pairs', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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

  it('populates accepted from all to recipients', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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

describe('unosendTransport — per-send overrides', () => {
  it('merges priority from ctx.transport.unosend into request body', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, {
      ...baseCtx,
      transport: { unosend: { priority: 'high' } },
    } as SendContext);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.priority).toBe('high');
  });

  it('merges scheduled_for from ctx.transport.unosend into request body', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, {
      ...baseCtx,
      transport: { unosend: { scheduled_for: '2026-06-01T10:00:00Z' } },
    } as SendContext);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.scheduled_for).toBe('2026-06-01T10:00:00Z');
  });

  it('merges tracking from ctx.transport.unosend into request body', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, {
      ...baseCtx,
      transport: { unosend: { tracking: { open: false, click: true } } },
    } as SendContext);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.tracking).toEqual({ open: false, click: true });
  });

  it('merges template_id and template_data from ctx.transport.unosend into request body', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, {
      ...baseCtx,
      transport: {
        unosend: {
          template_id: 'tmpl_welcome_001',
          template_data: { name: 'Alice', company: 'Acme' },
        },
      },
    } as SendContext);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.template_id).toBe('tmpl_welcome_001');
    expect(body.template_data).toEqual({ name: 'Alice', company: 'Acme' });
  });

  it('does not add override fields when ctx.transport.unosend is absent', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
    await t.send(baseMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.priority).toBeUndefined();
    expect(body.scheduled_for).toBeUndefined();
    expect(body.tracking).toBeUndefined();
    expect(body.template_id).toBeUndefined();
    expect(body.template_data).toBeUndefined();
  });
});

describe('unosendTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { unosendTransport } = await import('./index.js');
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('unosendTransport — Unosend API errors', () => {
  it('returns VALIDATION for 422 status', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Missing required field: to', code: 'missing_field' },
        }),
        { status: 422 },
      ),
    );
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.provider).toBe('unosend');
    expect(err.httpStatus).toBe(422);
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for 401 status', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Missing API key', code: 'unauthorized' },
        }),
        { status: 401 },
      ),
    );
    const t = unosendTransport({ apiKey: '' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('unosend');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for 403 status', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Invalid API key', code: 'forbidden' },
        }),
        { status: 403 },
      ),
    );
    const t = unosendTransport({ apiKey: 'un_bad_key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('unosend');
    expect(err.httpStatus).toBe(403);
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429 rate limit', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Rate limit exceeded', code: 'rate_limited' },
        }),
        { status: 429 },
      ),
    );
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.provider).toBe('unosend');
    expect(err.httpStatus).toBe(429);
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER for 500 server error (retriable)', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Internal server error', code: 'internal_error' },
        }),
        { status: 500 },
      ),
    );
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('unosend');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('includes error message in the error string', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { message: 'Invalid from address', code: 'validation_error' },
        }),
        { status: 422 },
      ),
    );
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('Invalid from address');
  });
});

describe('unosendTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('unosend');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBeUndefined();
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT when fetch throws AbortError', async () => {
    const { unosendTransport } = await import('./index.js');
    const abortErr = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortErr);
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.provider).toBe('unosend');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBeUndefined();
    expect(err.message).toContain('request timed out');
  });

  it('returns PROVIDER when response body is not valid JSON', async () => {
    const { unosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = unosendTransport({ apiKey: 'un_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('unosend');
    expect(err.retriable).toBe(true);
  });
});

describe('unosendTransport — attachments', () => {
  it('base64-encodes Buffer attachment content', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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

  it('omits content_type when not provided', async () => {
    const { unosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = unosendTransport({ apiKey: 'un_test_123' });
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

describe('unosendAdapter (stub)', () => {
  it('throws not-implemented', async () => {
    const { unosendAdapter } = await import('./index.js');
    expect(() => unosendAdapter()).toThrow(/not implemented/);
  });
});
