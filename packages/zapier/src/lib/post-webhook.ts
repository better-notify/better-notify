import { handlePromise, NotifyRpcError } from '@betternotify/core';

export type PostWebhookOptions = {
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
  const [fetchErr, response] = await handlePromise(
    fetch(opts.url, {
      method: 'POST',
      signal: AbortSignal.timeout(opts.timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts.body),
    }),
  );

  if (fetchErr) {
    const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError';
    return {
      ok: false,
      error: new NotifyRpcError({
        message: `Zapier: ${isTimeout ? 'request timed out' : `network error: ${fetchErr.message}`}`,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
        route: opts.route,
        messageId: opts.messageId,
        cause: fetchErr,
      }),
    };
  }

  if (!response.ok) {
    const code = response.status === 410 ? 'CONFIG' : 'PROVIDER';
    const detail =
      response.status === 410
        ? 'webhook URL expired or deleted'
        : `HTTP ${response.status}`;
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

  const [, data] = await handlePromise(response.json());

  return { ok: true, status: response.status, data: data ?? null };
};
