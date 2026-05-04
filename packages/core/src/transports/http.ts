import { createFetch } from '@better-fetch/fetch';
import type { FetchHooks, RetryOptions } from '@better-fetch/fetch';
import { handlePromise } from '../lib/handle-promise.js';

export type HttpRetryOptions = RetryOptions;

export type HttpClientHooks = Pick<
  FetchHooks,
  'onRequest' | 'onResponse' | 'onSuccess' | 'onError' | 'onRetry' | 'hookOptions'
>;

export type HttpClientOptions = HttpClientHooks & {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retry?: HttpRetryOptions;
  retryAttempt?: number;
};

export type HttpClientBehaviorOptions = Omit<HttpClientOptions, 'baseUrl' | 'headers'>;

export type HttpSuccess<T> = { ok: true; data: T | null };

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

export type HttpRequestInit = HttpClientHooks & {
  method?: string;
  body?: string | FormData | Uint8Array | null;
  headers?: Record<string, string>;
  retry?: HttpRetryOptions;
  retryAttempt?: number;
};

const chainContextHook =
  <TContext>(
    first?: (context: TContext) => Promise<TContext | Response | void> | TContext | Response | void,
    second?: (
      context: TContext,
    ) => Promise<TContext | Response | void> | TContext | Response | void,
  ) =>
  async (context: TContext): Promise<TContext | Response | void> => {
    let current = context;

    if (first) {
      const firstResult = await first(current);
      if (firstResult instanceof Response) {
        current = { ...current, response: firstResult } as TContext;
      } else if (typeof firstResult === 'object' && firstResult !== null) {
        current = firstResult as TContext;
      }
    }

    if (!second) return current;

    const secondResult = await second(current);
    return secondResult ?? current;
  };

const chainNotificationHook =
  <TContext>(
    first?: (context: TContext) => Promise<void> | void,
    second?: (context: TContext) => Promise<void> | void,
  ) =>
  async (context: TContext): Promise<void> => {
    await first?.(context);
    await second?.(context);
  };

const mergeHooks = (base: HttpClientHooks, override: HttpClientHooks): HttpClientHooks => {
  const hooks: HttpClientHooks = {
    hookOptions: { ...base.hookOptions, ...override.hookOptions },
  };

  if (base.onRequest || override.onRequest) {
    hooks.onRequest = chainContextHook(
      base.onRequest,
      override.onRequest,
    ) as FetchHooks['onRequest'];
  }

  if (base.onResponse || override.onResponse) {
    hooks.onResponse = chainContextHook(
      base.onResponse,
      override.onResponse,
    ) as FetchHooks['onResponse'];
  }

  if (base.onSuccess || override.onSuccess) {
    hooks.onSuccess = chainNotificationHook(
      base.onSuccess,
      override.onSuccess,
    ) as FetchHooks['onSuccess'];
  }

  if (base.onError || override.onError) {
    hooks.onError = chainNotificationHook(base.onError, override.onError) as FetchHooks['onError'];
  }

  if (base.onRetry || override.onRetry) {
    hooks.onRetry = chainNotificationHook(base.onRetry, override.onRetry) as FetchHooks['onRetry'];
  }

  return hooks;
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
    const hooks = mergeHooks(opts, init);
    const [networkErr, result] = await handlePromise(
      $fetch<T>(url, {
        method: init.method ?? 'GET',
        body: init.body ?? undefined,
        headers,
        retry: init.retry ?? opts.retry,
        retryAttempt: init.retryAttempt ?? opts.retryAttempt,
        ...hooks,
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
      const { status, statusText, ...body } = error;
      return {
        ok: false,
        kind: 'http',
        status,
        statusText,
        body: body as E,
      };
    }

    return { ok: true, data: (data ?? null) as T | null };
  };

  return { request };
};
