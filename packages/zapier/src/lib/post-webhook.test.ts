import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseOpts = {
  url: 'https://hooks.zapier.com/hooks/catch/123/abc',
  body: { event: 'test', data: { foo: 'bar' } },
  timeoutMs: 10_000,
};

describe('postWebhook', () => {
  it('POSTs JSON to the given URL', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    );

    await postWebhook(baseOpts);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(baseOpts.url);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe(
      'application/json',
    );
    expect(JSON.parse(init.body)).toEqual(baseOpts.body);
  });

  it('returns ok with parsed response data on 200', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 'abc' });
  });

  it('returns ok for empty response body (200)', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.status).toBe(200);
  });

  it('returns error with TIMEOUT code on timeout', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    const err = new DOMException('aborted', 'AbortError');
    fetchMock.mockRejectedValue(err);

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcError);
    expect(result.error.code).toBe('TIMEOUT');
  });

  it('returns error with PROVIDER code on network failure', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.code).toBe('PROVIDER');
    expect(result.error.message).toContain('network error');
  });

  it('returns error with CONFIG code on 410 Gone', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(new Response('Gone', { status: 410 }));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.code).toBe('CONFIG');
    expect(result.error.message).toContain('expired');
  });

  it('returns error with PROVIDER code on 4xx (non-410)', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(new Response('Bad Request', { status: 400 }));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.code).toBe('PROVIDER');
  });

  it('returns error with PROVIDER code on 5xx', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const result = await postWebhook(baseOpts);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.code).toBe('PROVIDER');
  });

  it('includes route and messageId in error when provided', async () => {
    const { postWebhook } = await import('./post-webhook.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await postWebhook({ ...baseOpts, route: 'orders.new', messageId: 'msg-1' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.route).toBe('orders.new');
    expect(result.error.messageId).toBe('msg-1');
  });
});
