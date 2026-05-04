import type { Address, RenderedMessage } from '@betternotify/email';
import { createTransport, normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import type { ZapierEmailPayload } from '../types.js';
import type { ZapierTransportOptions } from './zapier.types.js';
import { postWebhook } from '../lib/post-webhook.js';
import { validateWebhookUrl } from '../lib/validate-url.js';

const DEFAULT_TIMEOUT_MS = 10_000;

const toAddressObject = (addr: Address): { name?: string; email: string } => {
  if (typeof addr === 'string') return { email: addr };
  return addr.name ? { name: addr.name, email: addr.email } : { email: addr.email };
};

/** Email transport that posts rendered messages to a Zapier catch hook webhook. */
export const zapierTransport = (opts: ZapierTransportOptions) => {
  validateWebhookUrl(opts.webhookUrl);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'zapier' });

  return createTransport({
    name: 'zapier',

    async send(message: RenderedMessage, ctx) {
      if (!message.from) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Zapier transport: no "from" address configured',
            code: 'CONFIG',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      if (!message.to.length) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Zapier transport: "to" must have at least one recipient',
            code: 'VALIDATION',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const payload: ZapierEmailPayload = {
        type: 'email',
        route: ctx.route,
        messageId: ctx.messageId,
        timestamp: new Date().toISOString(),
        from: toAddressObject(message.from),
        to: message.to.map(toAddressObject),
        cc: (message.cc ?? []).map(toAddressObject),
        bcc: (message.bcc ?? []).map(toAddressObject),
        replyTo: message.replyTo ? toAddressObject(message.replyTo) : null,
        subject: message.subject,
        html: message.html,
        text: message.text ?? null,
        headers: message.headers ?? {},
        tags: message.tags ?? {},
        attachments: (message.attachments ?? []).map((att) => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : Buffer.from(att.content).toString('base64'),
          ...(att.contentType ? { contentType: att.contentType } : {}),
        })),
      };

      log.debug('posting email to Zapier webhook', { route: ctx.route });

      const result = await postWebhook({
        url: opts.webhookUrl,
        body: payload as unknown as Record<string, unknown>,
        timeoutMs,
        route: ctx.route,
        messageId: ctx.messageId,
      });

      if (!result.ok) {
        log.error('Zapier email webhook failed', { err: result.error, route: ctx.route });
        return result;
      }

      return {
        ok: true as const,
        data: {
          transportMessageId: undefined,
          accepted: message.to.map(normalizeAddress),
          rejected: [],
          raw: result.data,
        },
      };
    },
  });
};
