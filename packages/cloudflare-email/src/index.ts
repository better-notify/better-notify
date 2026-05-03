import type { Address, RenderedMessage, Transport } from '@betternotify/email';
import { normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, handlePromise, NotifyRpcError } from '@betternotify/core';
import type {
  CloudflareEmailTransportOptions,
  CloudflareEmailFrom,
  CloudflareEmailAttachment,
  CloudflareEmailRequest,
  CloudflareApiResponse,
} from './types.js';

export type {
  CloudflareEmailTransportOptions,
  CloudflareEmailFrom,
  CloudflareEmailAttachment,
  CloudflareEmailRequest,
  CloudflareApiResponse,
  CloudflareApiError,
  CloudflareEmailResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com';

const toFrom = (addr: Address): CloudflareEmailFrom => {
  if (typeof addr === 'string') return { email: addr };
  return addr.name ? { email: addr.email, name: addr.name } : { email: addr.email };
};

const toBase64 = (content: Buffer | string): string => {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(content).toString('base64');
};

const toAttachments = (
  attachments: NonNullable<RenderedMessage['attachments']>,
): CloudflareEmailAttachment[] =>
  attachments.map((att) => ({
    content: toBase64(att.content),
    filename: att.filename,
    type: att.contentType ?? 'application/octet-stream',
    disposition: att.cid ? 'inline' : 'attachment',
    ...(att.cid ? { contentId: att.cid } : {}),
  }));

const buildRequestBody = (message: RenderedMessage, from: Address): CloudflareEmailRequest => {
  const body: CloudflareEmailRequest = {
    from: toFrom(from),
    to: message.to.map(normalizeAddress),
    subject: message.subject,
  };

  if (message.html) body.html = message.html;
  if (message.text) body.text = message.text;
  if (message.cc?.length) body.cc = message.cc.map(normalizeAddress);
  if (message.bcc?.length) body.bcc = message.bcc.map(normalizeAddress);
  if (message.replyTo) body.reply_to = normalizeAddress(message.replyTo);
  if (message.headers && Object.keys(message.headers).length > 0) body.headers = message.headers;
  if (message.attachments?.length) body.attachments = toAttachments(message.attachments);

  return body;
};

export const cloudflareEmailTransport = (opts: CloudflareEmailTransportOptions): Transport => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/client/v4/accounts/${opts.accountId}/email/sending/send`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'cloudflare-email' });

  return {
    name: 'cloudflare-email',
    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Cloudflare Email transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const body = buildRequestBody(message, message.from);

      const [fetchErr, response] = await handlePromise(
        fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${opts.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      );

      if (fetchErr) {
        log.error('Cloudflare Email fetch failed', { err: fetchErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: `Cloudflare Email transport: network error: ${fetchErr.message}`,
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: fetchErr,
          }),
        };
      }

      const [parseErr, data] = await handlePromise(
        response.json() as Promise<CloudflareApiResponse>,
      );

      if (parseErr) {
        log.error('Cloudflare Email response parse failed', { err: parseErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: `Cloudflare Email transport: failed to parse response`,
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: parseErr,
          }),
        };
      }

      if (!data.success || !data.result) {
        const cfError = data.errors[0];
        const errorCode = cfError?.code;
        const code =
          errorCode === 10001 ||
          errorCode === 10200 ||
          errorCode === 10201 ||
          errorCode === 10202
            ? 'VALIDATION'
            : errorCode === 10203
              ? 'CONFIG'
              : 'PROVIDER';

        const errorMessage = cfError
          ? `Cloudflare Email transport: [${cfError.code}] ${cfError.message}`
          : `Cloudflare Email transport: unknown error (HTTP ${response.status})`;

        log.error(errorMessage, {
          err: { code: errorCode, message: cfError?.message },
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

      return {
        ok: true,
        data: {
          transportMessageId: undefined,
          accepted: [...data.result.delivered, ...data.result.queued],
          rejected: data.result.permanent_bounces,
          raw: data,
        },
      };
    },
  };
};
