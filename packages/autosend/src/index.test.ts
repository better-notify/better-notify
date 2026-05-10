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
    emailId: 'em_123',
    message: 'Email queued successfully.',
    totalRecipients: 1,
  },
};

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('autosendTransport', () => {
  it('sends a POST to /v1/mails/send with bearer auth and JSON content type', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.autosend.com/v1/mails/send');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers as Record<string, string>);
    expect(headers.get('Authorization')).toBe('Bearer as_test_123');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('maps RenderedMessage fields to the Autosend request body', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send(baseMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ name: 'App', email: 'noreply@example.com' });
    expect(body.to).toEqual({ email: 'user@example.com' });
    expect(body.subject).toBe('Hello');
    expect(body.html).toBe('<p>hi</p>');
    expect(body.text).toBe('hi');
  });

  it('returns transportMessageId from the Autosend response data', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('em_123');
    expect(result.data.accepted).toEqual(['user@example.com']);
    expect(result.data.rejected).toEqual([]);
    expect(result.data.raw).toEqual([okResponse]);
  });

  it('uses custom baseUrl when provided', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123', baseUrl: 'https://mock.local' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/v1/mails/send');
  });

  it('strips trailing slashes from baseUrl', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123', baseUrl: 'https://mock.local///' });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/v1/mails/send');
  });

  it('omits text and html when not present', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.html).toBeUndefined();
    expect(body.text).toBeUndefined();
  });

  it('has name "autosend"', async () => {
    const { autosendTransport } = await import('./index.js');
    const t = autosendTransport({ apiKey: 'as_test_123' });
    expect(t.name).toBe('autosend');
  });

  it('maps a string from address to { email }', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ email: 'plain@example.com' });
  });

  it('maps an object from address without name to { email } only', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send({ ...baseMessage, from: { email: 'no-name@example.com' } }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ email: 'no-name@example.com' });
  });

  it('maps a string to address to { email }', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    await t.send({ ...baseMessage, to: ['plain@example.com'] }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.to).toEqual({ email: 'plain@example.com' });
  });

  it('drops unsupported fields (cc, bcc, replyTo, headers, attachments, tags, priority, inlineAssets)', async () => {
    const { autosendTransport } = await import('./index.js');
    mockFetchOk();
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(
      {
        ...baseMessage,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        replyTo: 'reply@example.com',
        headers: { 'X-Campaign': 'launch' },
        attachments: [{ filename: 'x.txt', content: 'hi' }],
        tags: { campaign: 'launch' },
        priority: 'high',
        inlineAssets: { logo: { path: '/logo.png' } },
      },
      baseCtx,
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
    expect(body.replyTo).toBeUndefined();
    expect(body.headers).toBeUndefined();
    expect(body.attachments).toBeUndefined();
    expect(body.tags).toBeUndefined();
    expect(body.priority).toBeUndefined();
    expect(body.inlineAssets).toBeUndefined();
  });
});

describe('autosendTransport — multi-recipient fan-out', () => {
  it('fans out one HTTP request per `to` recipient', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { emailId: 'em_1', message: 'queued', totalRecipients: 1 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { emailId: 'em_2', message: 'queued', totalRecipients: 1 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { emailId: 'em_3', message: 'queued', totalRecipients: 1 },
          }),
          { status: 200 },
        ),
      );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(
      {
        ...baseMessage,
        to: [{ email: 'a@x.com' }, { email: 'b@x.com', name: 'Bee' }, 'c@x.com'],
      },
      baseCtx,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('em_1');
    expect(result.data.accepted).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    expect(result.data.rejected).toEqual([]);

    const recipients = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).to);
    expect(recipients).toEqual([
      { email: 'a@x.com' },
      { email: 'b@x.com', name: 'Bee' },
      { email: 'c@x.com' },
    ]);
  });

  it('partial failure → ok:true, accepted/rejected populated', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { emailId: 'em_1', message: 'queued', totalRecipients: 1 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Invalid recipient' }),
          { status: 422 },
        ),
      );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a@x.com' }, { email: 'broken' }] },
      baseCtx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['a@x.com']);
    expect(result.data.rejected).toEqual(['broken']);
  });

  it('all failures → ok:false with first error', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Invalid recipient' }), {
        status: 422,
      }),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(
      { ...baseMessage, to: [{ email: 'a' }, { email: 'b' }] },
      baseCtx,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.provider).toBe('autosend');
    expect(err.retriable).toBe(false);
  });
});

describe('autosendTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { autosendTransport } = await import('./index.js');
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('autosendTransport — Autosend API errors', () => {
  it('returns VALIDATION for 400 status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Bad request.' }), { status: 400 }),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.provider).toBe('autosend');
    expect(err.httpStatus).toBe(400);
    expect(err.retriable).toBe(false);
  });

  it('returns VALIDATION for 422 status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, message: 'Missing `to` field.' }),
        { status: 422 },
      ),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.httpStatus).toBe(422);
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('Missing `to` field.');
  });

  it('returns CONFIG for 401 status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Missing API key.' }), {
        status: 401,
      }),
    );
    const t = autosendTransport({ apiKey: '' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns CONFIG for 403 status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Forbidden.' }), { status: 403 }),
    );
    const t = autosendTransport({ apiKey: 'as_bad' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.httpStatus).toBe(403);
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429 status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Too many.' }), { status: 429 }),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.httpStatus).toBe(429);
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER (retriable) for 500 server error', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Internal error.' }), {
        status: 500,
      }),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER (not retriable) for unmapped 4xx status', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Teapot.' }), { status: 418 }),
    );
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(418);
    expect(err.retriable).toBe(false);
  });

  it('falls back to error field when message is missing', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'unauthorized' }), { status: 401 }),
    );
    const t = autosendTransport({ apiKey: '' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('unauthorized');
  });

  it('uses generic message when neither message nor error is present', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('request failed');
  });

  it('uses generic message when response body is empty/non-JSON', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('request failed');
  });
});

describe('autosendTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('autosend');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBeUndefined();
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT when fetch throws AbortError', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.provider).toBe('autosend');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });

  it('returns PROVIDER when response body is empty (null data)', async () => {
    const { autosendTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const t = autosendTransport({ apiKey: 'as_test_123' });
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('autosend');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('empty response body');
  });
});
