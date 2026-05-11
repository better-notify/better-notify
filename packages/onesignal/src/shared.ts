import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type { SendContext } from '@betternotify/core';
import type {
  OneSignalTransportOptions,
  OneSignalSuccessResponse,
  OneSignalErrorResponse,
  OneSignalBaseBody,
} from './types.js';

type OneSignalSendOptions = OneSignalTransportOptions & {
  body?: OneSignalBaseBody;
  bodyFor?: Partial<Record<string, OneSignalBaseBody>>;
};

const DEFAULT_BASE_URL = 'https://api.onesignal.com';
const DEFAULT_TIMEOUT_MS = 30_000;

export type OneSignalChannelConfig<TRendered, TData> = {
  channel: string;
  label: string;
  emptyIdMessage: string;
  buildBody: (rendered: TRendered) => Record<string, unknown>;
  mapSuccess: (data: OneSignalSuccessResponse, rendered: TRendered) => TData;
};

export const createOneSignalSend = <TRendered, TData>(
  config: OneSignalChannelConfig<TRendered, TData>,
  opts: OneSignalSendOptions,
) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/notifications?c=${config.channel}`;
  const log = (opts.logger ?? consoleLogger()).child({ component: `onesignal-${config.channel}` });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  return {
    name: `onesignal-${config.channel}`,

    async send(rendered: TRendered, ctx: SendContext) {
      const routeOverrides = opts.bodyFor?.[ctx.route as keyof typeof opts.bodyFor];
      const sendOverrides = ctx.transport?.onesignal;

      const body: Record<string, unknown> = {
        ...opts.body,
        ...routeOverrides,
        ...sendOverrides,
        ...config.buildBody(rendered),
        app_id: opts.appId,
        target_channel: config.channel,
      };

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
          log.error(`OneSignal ${config.label} fetch failed`, {
            err: result.cause,
            route: ctx.route,
          });

          return {
            ok: false as const,
            error: new NotifyRpcProviderError({
              message: `OneSignal ${config.label} transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'onesignal',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body;
        const { code, retriable } = mapHttpStatus(result.status);

        const errorMessage = `OneSignal ${config.label} transport: ${Array.isArray(errData.errors) ? errData.errors.join(', ') : `HTTP ${result.status}`}`;

        log.error(errorMessage, { err: { status: result.status }, route: ctx.route });

        return {
          ok: false as const,
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
        log.error(config.emptyIdMessage, { route: ctx.route });
        return {
          ok: false as const,
          error: new NotifyRpcProviderError({
            message: config.emptyIdMessage,
            code: 'VALIDATION',
            provider: 'onesignal',
            retriable: false,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      return {
        ok: true as const,
        data: config.mapSuccess(successData, rendered),
      };
    },
  };
};
