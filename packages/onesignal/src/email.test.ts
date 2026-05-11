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
};

const baseCtx: SendContext = { route: 'welcome', messageId: 'm1', attempt: 1 };

const okResponse = { id: 'notif-id-123' };

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('onesignalEmailTransport', () => {
  it('sends a POST to the OneSignal email endpoint', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.onesignal.com/notifications?c=email');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe(
      'Key api-key',
    );
  });

  it('maps RenderedMessage fields to request body', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(
      {
        ...baseMessage,
        replyTo: { email: 'reply@example.com' },
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.app_id).toBe('app-id');
    expect(body.email_subject).toBe('Hello');
    expect(body.email_body).toBe('<p>hi</p>');
    expect(body.email_to).toEqual(['user@example.com']);
    expect(body.email_from_address).toBe('noreply@example.com');
    expect(body.email_from_name).toBe('App');
    expect(body.email_reply_to_address).toBe('reply@example.com');
  });

  it('maps string from address', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.email_from_address).toBe('plain@example.com');
    expect(body.email_from_name).toBeUndefined();
  });

  it('omits email_from_name when from has no name', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send({ ...baseMessage, from: { email: 'noreply@example.com' } }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.email_from_address).toBe('noreply@example.com');
    expect(body.email_from_name).toBeUndefined();
  });

  it('omits from fields when from is not set', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await t.send(msg as RenderedMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.email_from_address).toBeUndefined();
    expect(body.email_from_name).toBeUndefined();
  });

  it('maps multiple to addresses', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(
      {
        ...baseMessage,
        to: [{ name: 'Alice', email: 'alice@example.com' }, 'bob@example.com'],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.email_to).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('returns EmailTransportData with transportMessageId on success', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('notif-id-123');
    expect(result.data.accepted).toEqual(['user@example.com']);
    expect(result.data.rejected).toEqual([]);
    expect(result.data.raw).toMatchObject({ id: 'notif-id-123' });
  });

  it('uses custom baseUrl', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      baseUrl: 'https://mock.local',
    });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/notifications?c=email');
  });

  it('has name "onesignal-email"', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    expect(t.name).toBe('onesignal-email');
  });

  it('returns VALIDATION error when response id is empty', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: '' }), { status: 200 }));
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('invalid or unsubscribed');
  });
});

describe('onesignalEmailTransport — HTTP errors', () => {
  it('returns CONFIG for 401', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Unauthorized'] }), { status: 401 }),
    );
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'bad-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Too many requests'] }), { status: 429 }),
    );
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER for 500', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Server error'] }), { status: 500 }),
    );
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('uses HTTP status as fallback message when errors array is absent', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 400 }));
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 400');
  });

  it('falls back to empty error object when response body is not parseable', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 502 }));
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 502');
  });

  it('forwards custom http.timeoutMs to the HTTP client', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      http: { timeoutMs: 5000 },
    });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(true);
  });
});

describe('onesignalEmailTransport — transport overrides', () => {
  it('merges ctx.transport.onesignal into request body', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    mockFetchOk();
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseMessage, {
      ...baseCtx,
      transport: {
        onesignal: { email_preheader: 'Preview text', disable_email_click_tracking: true },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.email_preheader).toBe('Preview text');
    expect(body.disable_email_click_tracking).toBe(true);
  });
});

describe('onesignalEmailTransport — network errors', () => {
  it('returns PROVIDER on network failure', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT on AbortError', async () => {
    const { onesignalEmailTransport } = await import('./email.js');
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const t = onesignalEmailTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });
});
