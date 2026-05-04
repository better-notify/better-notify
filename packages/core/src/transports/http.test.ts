import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http.js';

describe('createHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns parsed data for successful JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      baseUrl: 'https://api.example.test',
      headers: { Authorization: 'Bearer token' },
    });

    const result = await client.request<{ id: string }>('/messages', {
      headers: { 'X-Request-Id': 'req-1' },
    });

    expect(result).toEqual({ ok: true, data: { id: 'msg-1' } });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
    expect(String(url)).toBe('https://api.example.test/messages');
    expect(init.method).toBe('GET');
    expect(init.body).toBeNull();
    expect(init.headers.get('authorization')).toBe('Bearer token');
    expect(init.headers.get('x-request-id')).toBe('req-1');
  });

  it('returns null for successful empty JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('   ', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const client = createHttpClient();
    const result = await client.request<null>('https://api.example.test/empty');

    expect(result).toEqual({ ok: true, data: null });
  });

  it('passes explicit method and body through to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient();
    await client.request('https://api.example.test/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'hello' }),
    });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ body: 'hello' }));
    expect(init.headers.get('content-type')).toBe('application/json');
  });

  it('passes retry options through to better-fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'temporarily unavailable' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'msg-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const onRetry = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      retry: {
        type: 'linear',
        attempts: 2,
        delay: 0,
        shouldRetry: (response) => response?.status === 503,
      },
      onRetry: onRetry,
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages');

    expect(result).toEqual({ ok: true, data: { id: 'msg-2' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('passes request retryAttempt through to better-fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'temporarily unavailable' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'msg-3' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      retryAttempt: 2,
      retry: {
        type: 'linear',
        attempts: 2,
        delay: 0,
        shouldRetry: (response) => response?.status === 503,
      },
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages', {
      retryAttempt: 0,
    });

    expect(result).toEqual({ ok: true, data: { id: 'msg-3' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('composes client and request hooks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-4' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const events: string[] = [];
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      onRequest: (ctx) => {
        events.push('client-request');
        ctx.headers.set('X-Client-Hook', '1');
        return ctx;
      },
      onSuccess: () => {
        events.push('client-success');
      },
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages', {
      onRequest: (ctx) => {
        events.push('request-request');
        ctx.headers.set('X-Request-Hook', '1');
        return ctx;
      },
      onSuccess: () => {
        events.push('request-success');
      },
    });

    expect(result).toEqual({ ok: true, data: { id: 'msg-4' } });
    expect(events).toEqual([
      'client-request',
      'request-request',
      'client-success',
      'request-success',
    ]);

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
    expect(init.headers.get('x-client-hook')).toBe('1');
    expect(init.headers.get('x-request-hook')).toBe('1');
  });

  it('runs client-only request hooks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-5' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      onRequest: (ctx) => {
        ctx.headers.set('X-Client-Only-Hook', '1');
        return ctx;
      },
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages');

    expect(result).toEqual({ ok: true, data: { id: 'msg-5' } });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
    expect(init.headers.get('x-client-only-hook')).toBe('1');
  });

  it('keeps client hook context when request hooks return void', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-6' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const events: string[] = [];
    vi.stubGlobal('fetch', fetchMock);

    const client = createHttpClient({
      onRequest: (ctx) => {
        ctx.headers.set('X-Client-Hook', '1');
        return ctx;
      },
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages', {
      onRequest: (ctx) => {
        events.push(ctx.headers.get('x-client-hook') ?? 'missing');
      },
    });

    expect(result).toEqual({ ok: true, data: { id: 'msg-6' } });
    expect(events).toEqual(['1']);
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { headers: Headers }];
    expect(init.headers.get('x-client-hook')).toBe('1');
  });

  it('composes response hooks that replace responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: 'original' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const events: string[] = [];
    const client = createHttpClient({
      onResponse: () => {
        events.push('client-response');
        return new Response(JSON.stringify({ id: 'client' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const result = await client.request<{ id: string }>('https://api.example.test/messages', {
      onResponse: ({ response }) => {
        events.push('request-response');
        return response.json().then((data) => {
          expect(data).toEqual({ id: 'client' });
          return new Response(JSON.stringify({ id: 'request' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      },
    });

    expect(result).toEqual({ ok: true, data: { id: 'request' } });
    expect(events).toEqual(['client-response', 'request-response']);
  });

  it('composes client and request error hooks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'bad_request' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const events: string[] = [];
    const client = createHttpClient({
      onError: ({ error }) => {
        events.push(`client-error-${error.status}`);
      },
    });

    const result = await client.request<unknown, { error: string }>(
      'https://api.example.test/messages',
      {
        onError: ({ error }) => {
          events.push(`request-error-${error.status}`);
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      kind: 'http',
      status: 400,
      statusText: 'Bad Request',
      body: { error: 'bad_request' },
    });
    expect(events).toEqual(['client-error-400', 'request-error-400']);
  });

  it('returns http errors with status metadata and parsed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const client = createHttpClient();
    const result = await client.request<unknown, { error: string }>(
      'https://api.example.test/messages',
    );

    expect(result).toEqual({
      ok: false,
      kind: 'http',
      status: 429,
      statusText: 'Too Many Requests',
      body: { error: 'rate_limited' },
    });
  });

  it('returns network errors for fetch rejections', async () => {
    const error = new Error('socket closed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));

    const client = createHttpClient();
    const result = await client.request('https://api.example.test/messages');

    expect(result).toEqual({
      ok: false,
      kind: 'network',
      timedOut: false,
      cause: error,
    });
  });

  it('marks abort and timeout errors as timed out', async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));

    const client = createHttpClient({ timeoutMs: 1 });
    const result = await client.request('https://api.example.test/messages');

    expect(result).toEqual({
      ok: false,
      kind: 'network',
      timedOut: true,
      cause: error,
    });
  });
});
