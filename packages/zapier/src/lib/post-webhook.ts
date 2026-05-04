import { NotifyRpcError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type PostWebhookOptions = Omit<HttpClientBehaviorOptions, 'timeoutMs'> & {
  url: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  route?: string;
  messageId?: string;
};

export type PostWebhookResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; error: NotifyRpcError };

export const postWebhook = async (opts: PostWebhookOptions): Promise<PostWebhookResult> => {
  const http = createHttpClient({
    timeoutMs: opts.timeoutMs,
    retry: opts.retry,
    retryAttempt: opts.retryAttempt,
    onRequest: opts.onRequest,
    onResponse: opts.onResponse,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
    onRetry: opts.onRetry,
    hookOptions: opts.hookOptions,
  });
  const result = await http.request<unknown>(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.body),
  });

  if (!result.ok) {
    if (result.kind === 'network') {
      return {
        ok: false,
        error: new NotifyRpcError({
          message: `Zapier: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
          code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
          route: opts.route,
          messageId: opts.messageId,
          cause: result.cause,
        }),
      };
    }

    const code = result.status === 410 ? 'CONFIG' : 'PROVIDER';
    const detail =
      result.status === 410 ? 'webhook URL expired or deleted' : `HTTP ${result.status}`;
    return {
      ok: false,
      error: new NotifyRpcError({
        message: `Zapier: ${detail}`,
        code,
        route: opts.route,
        messageId: opts.messageId,
      }),
    };
  }

  return { ok: true, status: 200, data: result.data ?? null };
};
