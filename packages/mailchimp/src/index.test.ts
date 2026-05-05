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

const okResponse = [
  { email: 'user@example.com', status: 'sent', _id: 'abc123' },
];

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('mailchimpTransport', () => {
  it('sends a POST to the Mandrill /messages/send endpoint with key in body', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mandrillapp.com/api/1.0/messages/send');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe(
      'application/json',
    );
    const body = JSON.parse(init.body);
    expect(body.key).toBe('md-test-123');
  });

  it('maps RenderedMessage fields to Mandrill request body', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
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
    const msg = body.message;
    expect(msg.from_email).toBe('noreply@example.com');
    expect(msg.from_name).toBe('App');
    expect(msg.subject).toBe('Hello');
    expect(msg.html).toBe('<p>hi</p>');
    expect(msg.text).toBe('hi');
    expect(msg.to).toEqual([
      { email: 'user@example.com', type: 'to' },
      { email: 'cc@example.com', name: 'CC User', type: 'cc' },
      { email: 'bcc@example.com', type: 'bcc' },
    ]);
    expect(msg.headers).toEqual({
      'X-Campaign': 'launch',
      'Reply-To': '"Reply" <reply@example.com>',
    });
  });

  it('returns EmailTransportData with accepted/rejected from per-recipient status', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { email: 'a@x.com', status: 'sent', _id: 'id1' },
          { email: 'b@x.com', status: 'queued', _id: 'id2' },
          { email: 'c@x.com', status: 'rejected', reject_reason: 'hard-bounce', _id: 'id3' },
          { email: 'd@x.com', status: 'invalid', _id: 'id4' },
        ]),
        { status: 200 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }, { email: 'd@x.com' }] },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('id1');
    expect(result.data.accepted).toEqual(['a@x.com', 'b@x.com']);
    expect(result.data.rejected).toEqual(['c@x.com', 'd@x.com']);
    expect(result.data.raw).toEqual([
      { email: 'a@x.com', status: 'sent', _id: 'id1' },
      { email: 'b@x.com', status: 'queued', _id: 'id2' },
      { email: 'c@x.com', status: 'rejected', reject_reason: 'hard-bounce', _id: 'id3' },
      { email: 'd@x.com', status: 'invalid', _id: 'id4' },
    ]);
  });

  it('treats bounced status as rejected', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { email: 'a@x.com', status: 'sent', _id: 'id1' },
          { email: 'b@x.com', status: 'bounced', _id: 'id2' },
        ]),
        { status: 200 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['a@x.com']);
    expect(result.data.rejected).toEqual(['b@x.com']);
  });

  it('uses custom baseUrl when provided', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123', baseUrl: 'https://mock.local/api/1.0' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/api/1.0/messages/send');
  });

  it('has name "mailchimp"', async () => {
    const { mailchimpTransport } = await import('./index.js');
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    expect(t.name).toBe('mailchimp');
  });

  it('omits optional fields from request body when not in RenderedMessage', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const msg = body.message;
    expect(msg.text).toBeUndefined();
    expect(msg.attachments).toBeUndefined();
    expect(msg.images).toBeUndefined();
    expect(msg.tags).toBeUndefined();
    expect(msg.metadata).toBeUndefined();
  });

  it('maps string from address to from_email only', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.message.from_email).toBe('plain@example.com');
    expect(body.message.from_name).toBeUndefined();
  });

  it('uses first sent/queued recipient _id as transportMessageId', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { email: 'a@x.com', status: 'rejected', _id: 'rej1' },
          { email: 'b@x.com', status: 'sent', _id: 'sent1' },
        ]),
        { status: 200 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('sent1');
  });

  it('falls back to first recipient _id when all are rejected', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          { email: 'a@x.com', status: 'rejected', _id: 'rej1' },
          { email: 'b@x.com', status: 'invalid', _id: 'inv1' },
        ]),
        { status: 200 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a@x.com' }, { email: 'b@x.com' }] },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('rej1');
  });

  it('drops unsupported fields (priority, inlineAssets) without error', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
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
    expect(body.message.priority).toBeUndefined();
    expect(body.message.inlineAssets).toBeUndefined();
  });

  it('strips trailing slashes from custom baseUrl', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123', baseUrl: 'https://mock.local/api/1.0///' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/api/1.0/messages/send');
  });

  it('respects custom http.timeoutMs option', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123', http: { timeoutMs: 5000 } });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(true);
  });
});

describe('mailchimpTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { mailchimpTransport } = await import('./index.js');
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('mailchimpTransport — Mandrill API errors', () => {
  it('returns CONFIG for Invalid_Key error', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'Invalid_Key', message: 'Invalid API key' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'bad-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('mailchimp');
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for PaymentRequired error', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'PaymentRequired', message: 'Payment required' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for Unknown_Subaccount error', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'Unknown_Subaccount', message: 'Unknown subaccount' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for HTTP 401 status', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'Unauthorized', message: 'Unauthorized' }),
        { status: 401 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'bad-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.retriable).toBe(false);
    expect(err.httpStatus).toBe(401);
  });

  it('returns CONFIG for HTTP 403 status', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'Forbidden', message: 'Forbidden' }),
        { status: 403 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'bad-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.retriable).toBe(false);
    expect(err.httpStatus).toBe(403);
  });

  it('returns VALIDATION for ValidationError', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -2, name: 'ValidationError', message: 'Validation error' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429 status', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'TooManyRequests', message: 'Rate limit exceeded' }),
        { status: 429 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER for 500 server error (retriable)', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'GeneralError', message: 'Internal error' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER non-retriable for 4xx without special error name', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'SomeOtherError', message: 'Bad request' }),
        { status: 400 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(400);
    expect(err.retriable).toBe(false);
  });

  it('includes error name and message in the error string', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', code: -1, name: 'Invalid_Key', message: 'Invalid API key' }),
        { status: 500 },
      ),
    );
    const t = mailchimpTransport({ apiKey: 'bad-key' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('Invalid_Key');
    expect(result.error.message).toContain('Invalid API key');
  });

  it('falls back to status and "Unknown error" when error body has no name/message', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 502 }),
    );
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.message).toContain('502');
    expect(err.message).toContain('Unknown error');
    expect(err.code).toBe('PROVIDER');
    expect(err.retriable).toBe(true);
  });
});

describe('mailchimpTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('mailchimp');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBeUndefined();
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT when fetch throws AbortError', async () => {
    const { mailchimpTransport } = await import('./index.js');
    const abortErr = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortErr);
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.provider).toBe('mailchimp');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });

  it('returns PROVIDER when response body is not valid JSON', async () => {
    const { mailchimpTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.retriable).toBe(true);
  });
});

describe('mailchimpTransport — tags and metadata', () => {
  it('maps tag record keys to Mandrill tags array (values discarded)', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send(
      { ...baseMessage, tags: { campaign: 'launch', version: 2, active: true } },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.message.tags).toEqual(['campaign', 'version', 'active']);
  });
});

describe('mailchimpTransport — attachments', () => {
  it('base64-encodes Buffer attachment content', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
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
    expect(body.message.attachments).toEqual([
      {
        type: 'application/pdf',
        name: 'invoice.pdf',
        content: Buffer.from('pdf-bytes').toString('base64'),
      },
    ]);
    expect(body.message.images).toBeUndefined();
  });

  it('base64-encodes string attachment content', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
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
    expect(body.message.attachments[0].content).toBe(Buffer.from('hello world').toString('base64'));
  });

  it('routes CID attachments to images array', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
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
    expect(body.message.images).toEqual([
      {
        type: 'image/png',
        name: 'logo@inline',
        content: Buffer.from('png-bytes').toString('base64'),
      },
    ]);
    expect(body.message.attachments).toBeUndefined();
  });

  it('separates regular and CID attachments correctly', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          { filename: 'doc.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
          { filename: 'logo.png', content: Buffer.from('png'), contentType: 'image/png', cid: 'logo' },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.message.attachments).toHaveLength(1);
    expect(body.message.attachments[0].name).toBe('doc.pdf');
    expect(body.message.images).toHaveLength(1);
    expect(body.message.images[0].name).toBe('logo');
  });

  it('defaults contentType to application/octet-stream when not provided', async () => {
    const { mailchimpTransport } = await import('./index.js');
    mockFetchOk();
    const t = mailchimpTransport({ apiKey: 'md-test-123' });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'data.bin', content: Buffer.from('bytes') }],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.message.attachments[0].type).toBe('application/octet-stream');
  });
});
