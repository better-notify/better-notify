import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedPush } from '@betternotify/push';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcProviderError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

const baseRendered: RenderedPush = {
  title: 'Hello',
  body: 'World',
};

const baseCtx: SendContext = { route: 'notify', messageId: 'm1', attempt: 1 };

const okResponse = { id: 'abc-123-uuid' };

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('onesignalPushTransport', () => {
  it('sends a POST to the OneSignal push endpoint', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseRendered, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.onesignal.com/notifications?c=push');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe(
      'Key api-key',
    );
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('maps RenderedPush fields to request body', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(
      {
        title: 'Test Title',
        body: 'Test Body',
        data: { key: 'val' },
        badge: 3,
        to: ['sub-id-1', 'sub-id-2'],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.app_id).toBe('app-id');
    expect(body.headings).toEqual({ en: 'Test Title' });
    expect(body.contents).toEqual({ en: 'Test Body' });
    expect(body.custom_data).toEqual({ key: 'val' });
    expect(body.ios_badgeType).toBe('SetTo');
    expect(body.ios_badgeCount).toBe(3);
    expect(body.include_subscription_ids).toEqual(['sub-id-1', 'sub-id-2']);
  });

  it('wraps single string `to` in an array', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send({ ...baseRendered, to: 'single-sub-id' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.include_subscription_ids).toEqual(['single-sub-id']);
  });

  it('omits optional fields when not provided', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.custom_data).toBeUndefined();
    expect(body.ios_badgeType).toBeUndefined();
    expect(body.ios_badgeCount).toBeUndefined();
    expect(body.include_subscription_ids).toBeUndefined();
  });

  it('returns PushTransportData with messageId on success', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messageId).toBe('abc-123-uuid');
    expect(result.data.provider).toBe('onesignal');
  });

  it('uses custom baseUrl', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      baseUrl: 'https://mock.local',
    });
    await t.send(baseRendered, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/notifications?c=push');
  });

  it('strips trailing slash from baseUrl', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      baseUrl: 'https://mock.local/',
    });
    await t.send(baseRendered, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/notifications?c=push');
  });

  it('has name "onesignal-push"', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    expect(t.name).toBe('onesignal-push');
  });

  it('returns VALIDATION error when response id is empty string', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ id: '', errors: ['All included players are not subscribed'] }),
        { status: 200 },
      ),
    );
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.provider).toBe('onesignal');
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('invalid or unsubscribed');
  });
});

describe('onesignalPushTransport — HTTP errors', () => {
  it('returns CONFIG for 401', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Invalid app_id'] }), { status: 401 }),
    );
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'bad-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('onesignal');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('Invalid app_id');
  });

  it('returns RATE_LIMITED for 429', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Rate limit exceeded'] }), { status: 429 }),
    );
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER for 500', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: ['Internal server error'] }), { status: 500 }),
    );
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.retriable).toBe(true);
    expect(err.httpStatus).toBe(500);
  });

  it('uses HTTP status as fallback message when errors array is absent', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 400 }));
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 400');
  });

  it('falls back to empty error object when response body is not parseable', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 502 }));
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 502');
  });

  it('merges body into request body', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { ttl: 259200, priority: 5 },
    });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.ttl).toBe(259200);
    expect(body.priority).toBe(5);
  });

  it('merges bodyFor overrides for matching route', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { ttl: 259200, priority: 5 },
      bodyFor: { notify: { priority: 10, ios_sound: 'alarm.wav' } },
    });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.ttl).toBe(259200);
    expect(body.priority).toBe(10);
    expect(body.ios_sound).toBe('alarm.wav');
  });

  it('ignores bodyFor when route does not match', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { ttl: 100 },
      bodyFor: { 'other.route': { ttl: 999 } },
    });
    await t.send(baseRendered, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.ttl).toBe(100);
  });

  it('merges ctx.transport.onesignal overrides from send context', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { ttl: 100 },
      bodyFor: { notify: { priority: 5 } },
    });
    await t.send(baseRendered, {
      ...baseCtx,
      transport: { onesignal: { priority: 10, ios_sound: 'alarm.wav' } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.ttl).toBe(100);
    expect(body.priority).toBe(10);
    expect(body.ios_sound).toBe('alarm.wav');
  });

  it('ctx.transport.onesignal overrides body and bodyFor', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { ttl: 100, priority: 1 },
      bodyFor: { notify: { priority: 5 } },
    });
    await t.send(baseRendered, {
      ...baseCtx,
      transport: { onesignal: { priority: 10 } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.ttl).toBe(100);
    expect(body.priority).toBe(10);
  });

  it('rendered fields take precedence over all override layers', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      body: { contents: { en: 'from-body' } },
      bodyFor: { notify: { contents: { en: 'from-bodyFor' } } },
    });
    await t.send(baseRendered, {
      ...baseCtx,
      transport: { onesignal: { contents: { en: 'from-transport' } } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.contents).toEqual({ en: 'World' });
  });

  it('forwards custom http.timeoutMs to the HTTP client', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    mockFetchOk();
    const t = onesignalPushTransport({
      appId: 'app-id',
      apiKey: 'api-key',
      http: { timeoutMs: 5000 },
    });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(true);
  });
});

describe('onesignalPushTransport — network errors', () => {
  it('returns PROVIDER on network failure', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('onesignal');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT on AbortError', async () => {
    const { onesignalPushTransport } = await import('./push.js');
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const t = onesignalPushTransport({ appId: 'app-id', apiKey: 'api-key' });
    const result = await t.send(baseRendered, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });
});
