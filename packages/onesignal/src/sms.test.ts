import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedSms } from '@betternotify/sms';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcProviderError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

const baseRendered: RenderedSms = {
  body: 'Your code is 123456',
  to: '+15555551234',
};

const baseCtx: SendContext = { route: 'otp', messageId: 'm1', attempt: 1 };

const okResponse = { id: 'sms-id-456' };

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('onesignalSmsTransport', () => {
  it('sends a POST to the OneSignal SMS endpoint', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseRendered, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.onesignal.com/notifications?c=sms');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe(
      'Key api-key',
    );
  });

  it('maps RenderedSms fields to request body', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      from: '+15555550000',
    });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.app_id).toBe('app-id');
    expect(body.contents).toEqual({ en: 'Your code is 123456' });
    expect(body.target_channel).toBe('sms');
    expect(body.include_phone_numbers).toEqual(['+15555551234']);
    expect(body.sms_from).toBe('+15555550000');
  });

  it('omits include_phone_numbers when to is not provided', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send({ body: 'hello' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.include_phone_numbers).toBeUndefined();
  });

  it('omits sms_from when from is not provided in options', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.sms_from).toBeUndefined();
  });

  it('returns SmsTransportData with messageId on success', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messageId).toBe('sms-id-456');
    expect(result.data.provider).toBe('onesignal');
  });

  it('uses custom baseUrl', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      baseUrl: 'https://mock.local',
    });
    await t.send(baseRendered, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/notifications?c=sms');
  });

  it('has name "onesignal-sms"', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    expect(t.name).toBe('onesignal-sms');
  });

  it('returns VALIDATION error when response id is empty', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: '' }), { status: 200 }));
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('invalid or unsubscribed');
  });
});

describe('onesignalSmsTransport — HTTP errors', () => {
  it('returns CONFIG for 401', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Unauthorized'] }), { status: 401 }),
    );
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'bad-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Rate limit exceeded'] }), { status: 429 }),
    );
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER for 500', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Server error'] }), { status: 500 }),
    );
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('uses HTTP status as fallback message when errors array is absent', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 400 }));
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 400');
  });

  it('falls back to empty error object when response body is not parseable', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 502 }));
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 502');
  });

  it('forwards custom http.timeoutMs to the HTTP client', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      http: { timeoutMs: 5000 },
    });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(true);
  });
});

describe('onesignalSmsTransport — transport overrides', () => {
  it('merges ctx.transport.onesignal into request body', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    mockFetchOk();
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseRendered, {
      ...baseCtx,
      transport: { onesignal: { sms_media_urls: ['https://example.com/img.png'] } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.sms_media_urls).toEqual(['https://example.com/img.png']);
  });
});

describe('onesignalSmsTransport — network errors', () => {
  it('returns PROVIDER on network failure', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT on AbortError', async () => {
    const { onesignalSmsTransport } = await import('./sms.js');
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const t = onesignalSmsTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });
});
