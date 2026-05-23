import type { RenderedMessage } from '@betternotify/email';
import { createTransport, formatAddress, normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';
import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type {
  UnosendTransportOptions,
  UnosendAttachment,
  UnosendRequest,
  UnosendSuccessResponse,
  UnosendErrorResponse,
  UnosendPerSendData,
} from './types.js';

export type {
  UnosendTransportOptions,
  UnosendAttachment,
  UnosendRequest,
  UnosendSuccessResponse,
  UnosendErrorResponse,
  UnosendTag,
} from './types.js';

export { isUnosendRetriable } from './is-retriable.js';

const DEFAULT_BASE_URL = 'https://api.unosend.co';
const DEFAULT_TIMEOUT_MS = 30_000;

const toBase64 = (content: Buffer | string): string => {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(content).toString('base64');
};

const toAttachments = (
  attachments: NonNullable<RenderedMessage['attachments']>,
): UnosendAttachment[] =>
  attachments.map((att) => ({
    content: toBase64(att.content),
    filename: att.filename,
    ...(att.contentType ? { content_type: att.contentType } : {}),
  }));

const buildRequestBody = (message: RenderedMessage, from: string): UnosendRequest => {
  const body: UnosendRequest = {
    from,
    to: message.to.map(formatAddress),
    subject: message.subject,
  };

  if (message.html) body.html = message.html;
  if (message.text) body.text = message.text;
  if (message.cc?.length) body.cc = message.cc.map(formatAddress);
  if (message.bcc?.length) body.bcc = message.bcc.map(formatAddress);
  if (message.replyTo) body.reply_to = formatAddress(message.replyTo);
  if (message.headers && Object.keys(message.headers).length > 0) body.headers = message.headers;
  if (message.attachments?.length) body.attachments = toAttachments(message.attachments);
  if (message.tags && Object.keys(message.tags).length > 0) {
    body.tags = Object.entries(message.tags).map(([name, value]) => ({
      name,
      value: String(value),
    }));
  }

  return body;
};

/** @experimental Unosend transport using the Unosend HTTP API. */
export const unosendTransport = (opts: UnosendTransportOptions) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/emails`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'unosend' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return createTransport({
    name: 'unosend',
    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Unosend transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const body = buildRequestBody(message, formatAddress(message.from));

      const perSend = (ctx as Record<string, unknown>).transport as
        | Record<string, unknown>
        | undefined;
      const overrides = perSend?.unosend as UnosendPerSendData | undefined;
      if (overrides?.priority) body.priority = overrides.priority;
      if (overrides?.scheduled_for) body.scheduled_for = overrides.scheduled_for;
      if (overrides?.tracking) body.tracking = overrides.tracking;

      const result = await http.request<UnosendSuccessResponse, UnosendErrorResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Unosend fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Unosend transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'unosend',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? ({} as UnosendErrorResponse);
        const { code, retriable } = mapHttpStatus(result.status);
        const errMsg =
          'error' in errData && errData.error?.message
            ? errData.error.message
            : `HTTP ${result.status}`;
        const errorMessage = `Unosend transport: ${errMsg}`;
        log.error(errorMessage, {
          err: { status: result.status, message: errMsg },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'unosend',
            httpStatus: result.status,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const successData = result.data as UnosendSuccessResponse;
      return {
        ok: true,
        data: {
          transportMessageId: successData.data.id,
          accepted: message.to.map(normalizeAddress),
          rejected: [],
          raw: successData,
        },
      };
    },
  });
};

/** @experimental Unosend webhook adapter — not yet implemented; ships in a later release. */
export type UnosendAdapterOptions = {
  webhookSecret?: string;
};

/** @experimental Unosend webhook adapter — not yet implemented; ships in a later release. */
export const unosendAdapter = (_opts: UnosendAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/unosend webhook adapter');
};

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface TransportDataMap {
    unosend: import('./types.js').UnosendPerSendData;
  }
}
