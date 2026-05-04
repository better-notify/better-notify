import type { RenderedMessage } from '@betternotify/email';
import { createTransport, formatAddress, normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';
import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type {
  ResendTransportOptions,
  ResendAttachment,
  ResendRequest,
  ResendSuccessResponse,
  ResendErrorResponse,
} from './types.js';

export type {
  ResendTransportOptions,
  ResendAttachment,
  ResendRequest,
  ResendSuccessResponse,
  ResendErrorResponse,
  ResendTag,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.resend.com';
const DEFAULT_TIMEOUT_MS = 30_000;

const toBase64 = (content: Buffer | string): string => {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(content).toString('base64');
};

const toAttachments = (
  attachments: NonNullable<RenderedMessage['attachments']>,
): ResendAttachment[] =>
  attachments.map((att) => ({
    content: toBase64(att.content),
    filename: att.filename,
    ...(att.contentType ? { content_type: att.contentType } : {}),
    ...(att.cid ? { content_id: att.cid } : {}),
  }));

const buildRequestBody = (message: RenderedMessage, from: string): ResendRequest => {
  const body: ResendRequest = {
    from,
    to: message.to.map(formatAddress),
    subject: message.subject,
  };

  if (message.html) body.html = message.html;
  if (message.text) body.text = message.text;
  if (message.cc?.length) body.cc = message.cc.map(formatAddress);
  if (message.bcc?.length) body.bcc = message.bcc.map(formatAddress);
  if (message.replyTo) body.reply_to = [formatAddress(message.replyTo)];
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

const mapErrorCode = (status: number): 'VALIDATION' | 'CONFIG' | 'PROVIDER' => {
  if (status === 422) return 'VALIDATION';
  if (status === 401 || status === 403) return 'CONFIG';
  return 'PROVIDER';
};

/** @experimental Resend transport using the Resend HTTP API. */
export const resendTransport = (opts: ResendTransportOptions) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/emails`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'resend' });
  const http = createHttpClient({ timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });

  return createTransport({
    name: 'resend',
    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Resend transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const body = buildRequestBody(message, formatAddress(message.from));
      const result = await http.request<ResendSuccessResponse, ResendErrorResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Resend fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcError({
              message: `Resend transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? ({} as ResendErrorResponse);
        const code = mapErrorCode(result.status);
        const errorMessage = `Resend transport: [${errData.name}] ${errData.message}`;
        log.error(errorMessage, {
          err: { status: result.status, name: errData.name, message: errData.message },
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

      const successData = result.data as ResendSuccessResponse;
      return {
        ok: true,
        data: {
          transportMessageId: successData.id,
          accepted: message.to.map(normalizeAddress),
          rejected: [],
          raw: successData,
        },
      };
    },
  });
};

/** @experimental Resend webhook adapter — not yet implemented; ships in a later release. */
export type ResendAdapterOptions = {
  webhookSecret?: string;
};

/** @experimental Resend webhook adapter — not yet implemented; ships in a later release. */
export const resendAdapter = (_opts: ResendAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/resend webhook adapter');
};
