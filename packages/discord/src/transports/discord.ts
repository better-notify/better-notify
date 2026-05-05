import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
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

const mapError = (
  status: number,
): { code: 'VALIDATION' | 'CONFIG' | 'RATE_LIMITED' | 'PROVIDER'; retriable: boolean } => {
  if (status === 400) return { code: 'VALIDATION', retriable: false };
  if (status === 401 || status === 403 || status === 404)
    return { code: 'CONFIG', retriable: false };
  if (status === 429) return { code: 'RATE_LIMITED', retriable: true };
  return { code: 'PROVIDER', retriable: status >= 500 };
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
  if (opts.wait === true) parsed.searchParams.set('wait', 'true');
  const url = parsed.toString();
  const log = (opts.logger ?? consoleLogger()).child({ component: 'discord' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
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
            error: new NotifyRpcProviderError({
              message: `Discord transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'discord',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body as DiscordErrorResponse;
        const { code, retriable } = mapError(result.status);
        const retryAfterBody = errData.retry_after;
        const retryAfterMs = retryAfterBody ? Math.ceil(retryAfterBody * 1000) : undefined;
        const suffix = retryAfterBody ? ` (retry after ${retryAfterBody}s)` : '';
        const errorMessage = `Discord transport: ${errData.message ?? `HTTP ${result.status}`}${suffix}`;
        log.error(errorMessage, {
          err: { status: result.status, code: errData.code, message: errData.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'discord',
            httpStatus: result.status,
            providerCode: errData.code,
            retryAfterMs,
            retriable,
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
