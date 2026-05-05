import { NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type PostWebhookOptions = {
  url: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  route?: string;
  messageId?: string;
  http?: HttpClientBehaviorOptions;
};

export type PostWebhookResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; error: NotifyRpcProviderError };

export const postWebhook = async (opts: PostWebhookOptions): Promise<PostWebhookResult> => {
  const http = createHttpClient({ ...opts.http, timeoutMs: opts.timeoutMs });
  const result = await http.request<unknown>(opts.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts.body),
  });

  if (!result.ok) {
    if (result.kind === 'network') {
      return {
        ok: false,
        error: new NotifyRpcProviderError({
          message: `Zapier: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
          code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
          provider: 'zapier',
          retriable: true,
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
      error: new NotifyRpcProviderError({
        message: `Zapier: ${detail}`,
        code,
        provider: 'zapier',
        httpStatus: result.status,
        retriable: result.status >= 500,
        route: opts.route,
        messageId: opts.messageId,
      }),
    };
  }

  return { ok: true, status: 200, data: result.data ?? null };
};
