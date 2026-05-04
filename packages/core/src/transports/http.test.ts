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
    const result = await client.request<unknown, { error: string; status: number; statusText: string }>(
      'https://api.example.test/messages',
    );

    expect(result).toEqual({
      ok: false,
      kind: 'http',
      status: 429,
      statusText: 'Too Many Requests',
      body: { error: 'rate_limited', status: 429, statusText: 'Too Many Requests' },
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
