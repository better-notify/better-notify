import type { RenderedMessage, Address } from '@betternotify/email';
import { createTransport, formatAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient } from '@betternotify/core/transports';
import type {
  MailchimpTransportOptions,
  MandrillRecipient,
  MandrillMessage,
  MandrillRequest,
  MandrillSuccessResponse,
  MandrillErrorResponse,
  MandrillAttachment,
} from './types.js';

export type {
  MailchimpTransportOptions,
  MandrillRecipient,
  MandrillMessage,
  MandrillRequest,
  MandrillSuccessResponse,
  MandrillErrorResponse,
  MandrillAttachment,
  MandrillRecipientStatus,
} from './types.js';

export { isMailchimpRetriable } from './is-retriable.js';

const DEFAULT_BASE_URL = 'https://mandrillapp.com/api/1.0';
const DEFAULT_TIMEOUT_MS = 30_000;

const toBase64 = (content: Buffer | string): string => {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(content).toString('base64');
};

const toRecipients = (addresses: Address[], type: 'to' | 'cc' | 'bcc'): MandrillRecipient[] =>
  addresses.map((addr) => {
    if (typeof addr === 'string') return { email: addr, type };
    return { email: addr.email, ...(addr.name ? { name: addr.name } : {}), type };
  });

const buildMessage = (message: RenderedMessage, fromEmail: string, fromName?: string): MandrillMessage => {
  const to: MandrillRecipient[] = [
    ...toRecipients(message.to, 'to'),
    ...(message.cc?.length ? toRecipients(message.cc, 'cc') : []),
    ...(message.bcc?.length ? toRecipients(message.bcc, 'bcc') : []),
  ];

  const headers: Record<string, string> = { ...message.headers };
  if (message.replyTo) {
    headers['Reply-To'] = formatAddress(message.replyTo);
  }

  const msg: MandrillMessage = {
    from_email: fromEmail,
    ...(fromName ? { from_name: fromName } : {}),
    to,
    subject: message.subject,
  };

  if (message.html) msg.html = message.html;
  if (message.text) msg.text = message.text;
  if (Object.keys(headers).length > 0) msg.headers = headers;

  if (message.attachments?.length) {
    const regular: MandrillAttachment[] = [];
    const images: MandrillAttachment[] = [];

    for (const att of message.attachments) {
      const entry: MandrillAttachment = {
        type: att.contentType ?? 'application/octet-stream',
        name: att.filename,
        content: toBase64(att.content),
      };

      if (att.cid) {
        images.push(entry);
      } else {
        regular.push(entry);
      }
    }

    if (regular.length > 0) msg.attachments = regular;
    if (images.length > 0) msg.images = images;
  }

  if (message.tags && Object.keys(message.tags).length > 0) {
    msg.tags = Object.keys(message.tags);
  }

  return msg;
};

const CONFIG_ERRORS = new Set(['Invalid_Key', 'PaymentRequired', 'Unknown_Subaccount']);

const mapError = (
  status: number,
  errorName?: string,
): { code: 'VALIDATION' | 'CONFIG' | 'RATE_LIMITED' | 'PROVIDER'; retriable: boolean } => {
  if (status === 429) return { code: 'RATE_LIMITED', retriable: true };
  if (status === 401 || status === 403) return { code: 'CONFIG', retriable: false };
  if (errorName && CONFIG_ERRORS.has(errorName)) return { code: 'CONFIG', retriable: false };
  if (errorName === 'ValidationError') return { code: 'VALIDATION', retriable: false };
  return { code: 'PROVIDER', retriable: status >= 500 };
};

export const mailchimpTransport = (opts: MailchimpTransportOptions) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/messages/send`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'mailchimp' });
  const http = createHttpClient({ ...opts.http, timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS });

  return createTransport({
    name: 'mailchimp',
    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Mailchimp transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const from = typeof message.from === 'string'
        ? { email: message.from }
        : message.from;

      const body: MandrillRequest = {
        key: opts.apiKey,
        message: buildMessage(message, from.email, from.name),
      };

      const result = await http.request<MandrillSuccessResponse, MandrillErrorResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Mailchimp fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Mailchimp transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'mailchimp',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? ({} as MandrillErrorResponse);
        const { code, retriable } = mapError(result.status, errData.name);
        const errorMessage = `Mailchimp transport: [${errData.name ?? result.status}] ${errData.message ?? 'Unknown error'}`;
        log.error(errorMessage, {
          err: { status: result.status, name: errData.name, message: errData.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'mailchimp',
            httpStatus: result.status,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const recipients = result.data as MandrillSuccessResponse;
      const accepted = recipients
        .filter((r) => r.status === 'sent' || r.status === 'queued')
        .map((r) => r.email);
      const rejected = recipients
        .filter((r) => r.status === 'rejected' || r.status === 'invalid' || r.status === 'bounced')
        .map((r) => r.email);

      const firstAccepted = recipients.find((r) => r.status === 'sent' || r.status === 'queued');
      const transportMessageId = firstAccepted?._id ?? recipients[0]?._id;

      return {
        ok: true,
        data: {
          transportMessageId,
          accepted,
          rejected,
          raw: recipients,
        },
      };
    },
  });
};
