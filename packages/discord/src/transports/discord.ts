import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import { createTransport, createHttpClient } from '@betternotify/core/transports';
import type { RenderedDiscord } from '../types.js';
import type { DiscordTransportData, Transport } from './types.js';
import type { DiscordTransportOptions } from './discord.types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

type DiscordErrorResponse = {
  message?: string;
  code?: number;
  retry_after?: number;
};

type DiscordSuccessResponse = {
  id: string;
  [key: string]: unknown;
};

const mapErrorCode = (status: number): 'VALIDATION' | 'CONFIG' | 'PROVIDER' => {
  if (status === 400) return 'VALIDATION';
  if (status === 401 || status === 403 || status === 404) return 'CONFIG';
  return 'PROVIDER';
};

const buildJsonPayload = (
  rendered: RenderedDiscord,
  opts: DiscordTransportOptions,
): Record<string, unknown> => {
  const body: Record<string, unknown> = { content: rendered.body };

  if (rendered.embeds?.length) body.embeds = rendered.embeds;

  const username = rendered.username ?? opts.username;
  if (username) body.username = username;

  const avatarUrl = rendered.avatarUrl ?? opts.avatarUrl;
  if (avatarUrl) body.avatar_url = avatarUrl;

  if (rendered.attachments?.length) {
    body.attachments = rendered.attachments.map((att, i) => ({
      id: i,
      filename: att.filename,
      ...(att.description ? { description: att.description } : {}),
    }));
  }

  return body;
};

const buildRequest = (
  rendered: RenderedDiscord,
  opts: DiscordTransportOptions,
): { body: string | FormData; headers?: Record<string, string> } => {
  const payload = buildJsonPayload(rendered, opts);

  if (!rendered.attachments?.length) {
    return {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));

  for (const [i, att] of rendered.attachments.entries()) {
    const raw = typeof att.content === 'string' ? Buffer.from(att.content) : att.content;
    const file = new File([raw], att.filename, {
      type: att.contentType ?? 'application/octet-stream',
    });
    form.append(`files[${i}]`, file);
  }

  return { body: form };
};

export const discordTransport = (opts: DiscordTransportOptions): Transport => {
  const parsed = new URL(opts.webhookUrl);
  if (opts.wait && opts.wait === true) parsed.searchParams.set('wait', 'true');
  const url = parsed.toString();
  const log = (opts.logger ?? consoleLogger()).child({ component: 'discord' });
  const http = createHttpClient({
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retry: opts.retry,
    retryAttempt: opts.retryAttempt,
    onRequest: opts.onRequest,
    onResponse: opts.onResponse,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
    onRetry: opts.onRetry,
    hookOptions: opts.hookOptions,
  });

  return createTransport<RenderedDiscord, DiscordTransportData>({
    name: 'discord',
    async send(rendered, ctx) {
      const { body, headers } = buildRequest(rendered, opts);
      const result = await http.request<DiscordSuccessResponse, DiscordErrorResponse>(url, {
        method: 'POST',
        body,
        headers,
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Discord fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcError({
              message: `Discord transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? {};
        const code = mapErrorCode(result.status);
        const retryAfterBody = errData.retry_after;
        const suffix = retryAfterBody ? ` (retry after ${retryAfterBody}s)` : '';
        const errorMessage = `Discord transport: ${errData.message ?? `HTTP ${result.status}`}${suffix}`;
        log.error(errorMessage, {
          err: { status: result.status, code: errData.code, message: errData.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcError({
            message: errorMessage,
            code,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      if (!result.data || !('id' in result.data)) {
        return {
          ok: true as const,
          data: { transportMessageId: undefined, raw: {} } satisfies DiscordTransportData,
        };
      }

      return {
        ok: true as const,
        data: {
          transportMessageId: result.data.id,
          raw: result.data,
        } satisfies DiscordTransportData,
      };
    },
  });
};
