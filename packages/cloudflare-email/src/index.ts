import type { Address, RenderedMessage, Transport } from '@betternotify/email';
import { normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
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

export { isCloudflareEmailRetriable } from './is-retriable.js';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com';
const VALIDATION_CODES = [10001, 10200, 10201, 10202];
const RATE_LIMITED_CODES = [10004];
const DEFAULT_TIMEOUT_MS = 30_000;

const mapCfError = (
  errorCode: number | undefined,
  httpStatus: number,
): { code: 'VALIDATION' | 'CONFIG' | 'RATE_LIMITED' | 'PROVIDER'; retriable: boolean } => {
  if (errorCode !== undefined) {
    if (VALIDATION_CODES.includes(errorCode)) return { code: 'VALIDATION', retriable: false };
    if (errorCode === 10203) return { code: 'CONFIG', retriable: false };
    if (RATE_LIMITED_CODES.includes(errorCode)) return { code: 'RATE_LIMITED', retriable: true };
  }
  if (httpStatus === 429) return { code: 'RATE_LIMITED', retriable: true };
  return { code: 'PROVIDER', retriable: httpStatus >= 500 };
};

const toFrom = (addr: Address): CloudflareEmailFrom => {
  if (typeof addr === 'string') return { address: addr };
  return addr.name ? { address: addr.email, name: addr.name } : { address: addr.email };
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
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

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
      const result = await http.request<CloudflareApiResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Cloudflare Email fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Cloudflare Email transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'cloudflare-email',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errBody =
          result.body && typeof result.body === 'object'
            ? (result.body as Partial<CloudflareApiResponse>)
            : ({} as Partial<CloudflareApiResponse>);
        const errors = Array.isArray(errBody.errors) ? errBody.errors : [];
        const cfError = errors[0];
        const errorCode = cfError?.code;
        const mapped = mapCfError(errorCode as number | undefined, result.status);
        const errorMessage = cfError
          ? `Cloudflare Email transport: [${cfError.code}] ${cfError.message}`
          : `Cloudflare Email transport: unknown error`;

        log.error(errorMessage, {
          err: { code: errorCode, message: cfError?.message },
          route: ctx.route,
        });
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code: mapped.code,
            provider: 'cloudflare-email',
            retriable: mapped.retriable,
            httpStatus: result.status,
            providerCode: errorCode as number | undefined,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const data = result.data;
      if (!data) {
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: 'Cloudflare Email transport: empty response body',
            code: 'PROVIDER',
            provider: 'cloudflare-email',
            retriable: true,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const errors = Array.isArray(data.errors) ? data.errors : [];
      const cfResult = data.result;

      if (!data.success || !cfResult) {
        const cfError = errors[0];
        const errorCode = cfError?.code;
        const mapped = mapCfError(errorCode as number | undefined, 200);

        const errorMessage = cfError
          ? `Cloudflare Email transport: [${cfError.code}] ${cfError.message}`
          : `Cloudflare Email transport: unknown error`;

        log.error(errorMessage, {
          err: { code: errorCode, message: cfError?.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code: mapped.code,
            provider: 'cloudflare-email',
            retriable: mapped.retriable,
            providerCode: errorCode as number | undefined,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      return {
        ok: true,
        data: {
          transportMessageId: undefined,
          accepted: [
            ...(Array.isArray(cfResult.delivered) ? cfResult.delivered : []),
            ...(Array.isArray(cfResult.queued) ? cfResult.queued : []),
          ],
          rejected: Array.isArray(cfResult.permanent_bounces) ? cfResult.permanent_bounces : [],
          raw: data,
        },
      };
    },
  };
};
