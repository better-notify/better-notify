import { consoleLogger, handlePromise, NotifyRpcError } from '@betternotify/core';
import { createTransport } from '@betternotify/core/transports';
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

const buildFetchInit = (
  rendered: RenderedDiscord,
  opts: DiscordTransportOptions,
  timeoutMs: number,
): RequestInit => {
  const payload = buildJsonPayload(rendered, opts);

  if (!rendered.attachments?.length) {
    return {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
  }

  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));

  for (let i = 0; i < rendered.attachments.length; i++) {
    const att = rendered.attachments[i];
    if (!att) continue;
    const raw = typeof att.content === 'string' ? Buffer.from(att.content) : att.content;
    const file = new File([raw], att.filename, { type: att.contentType ?? 'application/octet-stream' });
    form.append(`files[${i}]`, file);
  }

  return {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    body: form,
  };
};

export const discordTransport = (opts: DiscordTransportOptions): Transport => {
  const url = opts.wait ? `${opts.webhookUrl}?wait=true` : opts.webhookUrl;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'discord' });

  return createTransport<RenderedDiscord, DiscordTransportData>({
    name: 'discord',
    async send(rendered, ctx) {
      const init = buildFetchInit(rendered, opts, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      const [fetchErr, response] = await handlePromise(
        fetch(url, init),
      );

      if (fetchErr) {
        const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError';
        log.error('Discord fetch failed', { err: fetchErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: `Discord transport: ${isTimeout ? 'request timed out' : `network error: ${fetchErr.message}`}`,
            code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: fetchErr,
          }),
        };
      }

      if (response.status === 204) {
        return {
          ok: true as const,
          data: { transportMessageId: undefined, raw: {} } satisfies DiscordTransportData,
        };
      }

      const [parseErr, data] = await handlePromise(
        response.json() as Promise<DiscordSuccessResponse | DiscordErrorResponse>,
      );

      if (parseErr) {
        log.error('Discord response parse failed', { err: parseErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Discord transport: failed to parse response',
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: parseErr,
          }),
        };
      }

      if (!response.ok) {
        const errData = data as DiscordErrorResponse;
        const code = mapErrorCode(response.status);
        const retryAfter = response.headers.get('retry-after');
        const suffix = retryAfter ? ` (retry after ${retryAfter}s)` : '';

        const errorMessage = `Discord transport: ${errData.message ?? `HTTP ${response.status}`}${suffix}`;
        log.error(errorMessage, {
          err: { status: response.status, code: errData.code, message: errData.message },
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

      const successData = data as DiscordSuccessResponse;
      return {
        ok: true as const,
        data: {
          transportMessageId: successData.id,
          raw: successData,
        } satisfies DiscordTransportData,
      };
    },
  });
};
