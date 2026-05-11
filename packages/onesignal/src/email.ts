import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import { createTransport, normalizeAddress } from '@betternotify/email/transports';
import type { Transport } from '@betternotify/email/transports';
import type {
  OneSignalTransportOptions,
  OneSignalSuccessResponse,
  OneSignalErrorResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.onesignal.com';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates an email transport backed by the OneSignal Notifications API.
 */
export const onesignalEmailTransport = (opts: OneSignalTransportOptions): Transport => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/notifications?c=email`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'onesignal-email' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return createTransport({
    name: 'onesignal-email',

    async send(rendered, ctx) {
      const to = rendered.to.map(normalizeAddress);

      const body: Record<string, unknown> = {
        app_id: opts.appId,
        email_subject: rendered.subject,
        email_body: rendered.html,
        email_to: to,
      };

      if (rendered.from) {
        const from = rendered.from;
        body.email_from_address = normalizeAddress(from);
        if (typeof from !== 'string' && from.name) body.email_from_name = from.name;
      }

      if (rendered.replyTo) body.email_reply_to_address = normalizeAddress(rendered.replyTo);

      const result = await http.request<OneSignalSuccessResponse, OneSignalErrorResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Key ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('OneSignal email fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `OneSignal email transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'onesignal',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? ({} as OneSignalErrorResponse);
        const { code, retriable } = mapHttpStatus(result.status);
        const errorMessage = `OneSignal email transport: ${Array.isArray(errData.errors) ? errData.errors.join(', ') : `HTTP ${result.status}`}`;
        log.error(errorMessage, { err: { status: result.status }, route: ctx.route });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'onesignal',
            httpStatus: result.status,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const successData = result.data as OneSignalSuccessResponse;

      if (!successData.id) {
        const errorMessage =
          'OneSignal email transport: all targeted addresses are invalid or unsubscribed';
        log.error(errorMessage, { route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code: 'VALIDATION',
            provider: 'onesignal',
            retriable: false,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      return {
        ok: true,
        data: {
          transportMessageId: successData.id,
          accepted: to,
          rejected: [],
          raw: successData,
        },
      };
    },
  });
};
