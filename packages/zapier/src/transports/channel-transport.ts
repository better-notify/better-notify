import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import { createTransport } from '@betternotify/core/transports';
import type { RenderedZapier, ZapierWebhookPayload } from '../types.js';
import type { ZapierChannelTransportData, Transport } from './types.js';
import type { ZapierChannelTransportOptions } from './channel-transport.types.js';
import { postWebhook } from '../lib/post-webhook.js';
import { validateWebhookUrl } from '../lib/validate-url.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Zapier channel transport — posts structured webhook payloads to Zapier catch hooks. */
export const zapierChannelTransport = (opts: ZapierChannelTransportOptions): Transport => {
  validateWebhookUrl(opts.webhookUrl);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'zapier-channel' });

  return createTransport<RenderedZapier, ZapierChannelTransportData>({
    name: 'zapier-channel',

    async send(rendered, ctx) {
      const url = rendered.webhookUrl ?? opts.webhookUrl;

      if (!url) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Zapier channel: no webhook URL — set in slot or transport options',
            code: 'CONFIG',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      if (rendered.webhookUrl) {
        validateWebhookUrl(rendered.webhookUrl);
      }

      if (!rendered.event) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Zapier channel: event name is required',
            code: 'VALIDATION',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const payload: ZapierWebhookPayload = {
        event: rendered.event,
        route: ctx.route,
        messageId: ctx.messageId,
        timestamp: new Date().toISOString(),
        data: rendered.data,
      };

      if (rendered.meta) {
        payload.meta = rendered.meta;
      }

      log.debug('posting to Zapier webhook', { event: rendered.event, route: ctx.route });

      const result = await postWebhook({
        url,
        body: payload as unknown as Record<string, unknown>,
        timeoutMs,
        retry: opts.retry,
        retryAttempt: opts.retryAttempt,
        onRequest: opts.onRequest,
        onResponse: opts.onResponse,
        onSuccess: opts.onSuccess,
        onError: opts.onError,
        onRetry: opts.onRetry,
        hookOptions: opts.hookOptions,
        route: ctx.route,
        messageId: ctx.messageId,
      });

      if (!result.ok) {
        log.error('Zapier webhook failed', { err: result.error, route: ctx.route });
        return result;
      }

      return {
        ok: true as const,
        data: {
          status: result.status,
          raw: result.data,
        } satisfies ZapierChannelTransportData,
      };
    },
  });
};
