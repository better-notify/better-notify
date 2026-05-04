import { createFetch } from '@better-fetch/fetch';
import { handlePromise } from '../lib/handle-promise.js';

export type HttpClientOptions = {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type HttpSuccess<T> = { ok: true; data: T };

export type HttpNetworkError = {
  ok: false;
  kind: 'network';
  timedOut: boolean;
  cause: Error;
};

export type HttpStatusError<E = unknown> = {
  ok: false;
  kind: 'http';
  status: number;
  statusText: string;
  body: E;
};

export type HttpResult<T, E = unknown> = HttpSuccess<T> | HttpNetworkError | HttpStatusError<E>;

type HttpRequestInit = {
  method?: string;
  body?: string | FormData | Uint8Array | null;
  headers?: Record<string, string>;
};

/**
 * Creates a configured HTTP client backed by `@better-fetch/fetch`.
 *
 * Wraps the fetch call so callers receive a discriminated `HttpResult` union
 * instead of managing `handlePromise` + JSON parsing + `response.ok` checks
 * individually in every transport.
 */
export const createHttpClient = (opts: HttpClientOptions = {}) => {
  const $fetch = createFetch({
    baseURL: opts.baseUrl,
    headers: opts.headers,
    timeout: opts.timeoutMs ?? 30_000,
    jsonParser: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      return JSON.parse(trimmed);
    },
  });

  const request = async <T, E = unknown>(
    url: string,
    init: HttpRequestInit = {},
  ): Promise<HttpResult<T, E>> => {
    const headers = { ...opts.headers, ...init.headers };
    const [networkErr, result] = await handlePromise(
      $fetch<T>(url, {
        method: init.method ?? 'GET',
        body: init.body ?? undefined,
        headers,
      }),
    );

    if (networkErr) {
      return {
        ok: false,
        kind: 'network',
        timedOut: networkErr.name === 'AbortError' || networkErr.name === 'TimeoutError',
        cause: networkErr,
      };
    }

    const { data, error } = result;

    if (error) {
      return {
        ok: false,
        kind: 'http',
        status: error.status,
        statusText: error.statusText,
        body: error as E,
      };
    }

    return { ok: true, data: data as T };
  };

  return { request };
};
