import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type { RenderedPush, PushTransportData, Transport } from '@betternotify/push';
import type {
  OneSignalTransportOptions,
  OneSignalSuccessResponse,
  OneSignalErrorResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.onesignal.com';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates a push notification transport backed by the OneSignal Notifications API.
 */
export const onesignalPushTransport = (opts: OneSignalTransportOptions): Transport => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/notifications?c=push`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'onesignal-push' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return createTransport<RenderedPush, PushTransportData>({
    name: 'onesignal-push',

    async send(rendered, ctx) {
      const body: Record<string, unknown> = {
        app_id: opts.appId,
        contents: { en: rendered.body },
        headings: { en: rendered.title },
      };

      if (rendered.data) body.custom_data = rendered.data;
      if (rendered.badge !== undefined) {
        body.ios_badgeType = 'SetTo';
        body.ios_badgeCount = rendered.badge;
      }
      if (rendered.to !== undefined) {
        body.include_subscription_ids = Array.isArray(rendered.to)
          ? rendered.to
          : [rendered.to];
      }

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
          log.error('OneSignal push fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `OneSignal push transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
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
        const errorMessage = `OneSignal push transport: ${Array.isArray(errData.errors) ? errData.errors.join(', ') : `HTTP ${result.status}`}`;
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
          'OneSignal push transport: all targeted subscriptions are invalid or unsubscribed';
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
