import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type { RenderedSms, SmsTransportData, Transport } from '@betternotify/sms';
import type {
  OneSignalSmsTransportOptions,
  OneSignalSuccessResponse,
  OneSignalErrorResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.onesignal.com';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates an SMS transport backed by the OneSignal Notifications API.
 */
export const onesignalSmsTransport = (opts: OneSignalSmsTransportOptions): Transport => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/notifications?c=sms`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'onesignal-sms' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return createTransport<RenderedSms, SmsTransportData>({
    name: 'onesignal-sms',

    async send(rendered, ctx) {
      const body: Record<string, unknown> = {
        app_id: opts.appId,
        contents: { en: rendered.body },
        target_channel: 'sms',
      };

      if (rendered.to !== undefined) body.include_phone_numbers = [rendered.to];
      if (opts.from !== undefined) body.sms_from = opts.from;

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
          log.error('OneSignal SMS fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `OneSignal SMS transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
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
        const errorMessage = `OneSignal SMS transport: ${Array.isArray(errData.errors) ? errData.errors.join(', ') : `HTTP ${result.status}`}`;
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
          'OneSignal SMS transport: all targeted phone numbers are invalid or unsubscribed';
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
          messageId: successData.id,
          provider: 'onesignal',
        },
      };
    },
  });
};
