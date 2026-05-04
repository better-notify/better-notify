import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
import type { RenderedTelegram } from '../types.js';
import type { TelegramTransportData, Transport } from './types.js';
import type { TelegramTransportOptions } from './telegram.types.js';

type TelegramApiResponse = {
  ok: boolean;
  result?: { message_id?: number; chat?: { id?: number }; [key: string]: unknown };
  description?: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const methodForAttachment = (type: string): string => {
  const map: Record<string, string> = {
    photo: 'sendPhoto',
    document: 'sendDocument',
    video: 'sendVideo',
    audio: 'sendAudio',
  };
  return map[type] ?? 'sendDocument';
};

export const telegramTransport = (opts: TelegramTransportOptions): Transport => {
  const apiUrl = opts.apiUrl ?? 'https://api.telegram.org';
  const log = (opts.logger ?? consoleLogger()).child({ component: 'telegram' });
  const http = createHttpClient({ ...opts.http, timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS });

  const buildUrl = (method: string): string => `${apiUrl}/bot${opts.token}/${method}`;

  const callApi = async (
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramApiResponse> => {
    const url = buildUrl(method);
    log.debug('calling Telegram API', { method });

    const result = await http.request<TelegramApiResponse>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      const isTimeout = result.kind === 'network' && result.timedOut;
      throw new NotifyRpcError({
        message: `Telegram ${method}: ${result.kind === 'network' ? (isTimeout ? 'request timed out' : `network error: ${result.cause.message}`) : `HTTP ${result.status}`}`,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
        cause: result.kind === 'network' ? result.cause : undefined,
      });
    }

    return result.data as TelegramApiResponse;
  };

  return {
    name: 'telegram',

    async send(rendered: RenderedTelegram, ctx) {
      const attachment = rendered.attachment;
      const method = attachment ? methodForAttachment(attachment.type) : 'sendMessage';

      const body: Record<string, unknown> = {
        chat_id: rendered.to,
      };

      if (rendered.parseMode) {
        body.parse_mode = rendered.parseMode;
      }

      if (attachment) {
        body[attachment.type] = attachment.url;
        body.caption = attachment.caption ?? rendered.body;
      } else {
        body.text = rendered.body;
      }

      const json = await callApi(method, body);

      if (!json.ok) {
        const description = json.description ?? 'Unknown Telegram API error';
        log.error('Telegram API error', { err: new Error(description), route: ctx.route });
        throw new NotifyRpcError({
          message: `Telegram ${method} failed: ${description}`,
          code: 'PROVIDER',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const result = json.result;
      const messageId = result?.message_id ?? 0;
      const chatId = result?.chat?.id ?? 0;

      return {
        ok: true as const,
        data: { messageId, chatId } satisfies TelegramTransportData,
      };
    },

    async verify() {
      const json = await callApi('getMe', {});

      if (!json.ok) {
        return { ok: false, details: json.description ?? 'Unknown error' };
      }

      return { ok: true, details: json.result };
    },
  };
};
