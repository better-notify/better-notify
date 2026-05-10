import type { Address, RenderedMessage } from '@betternotify/email';
import { createTransport, normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient, mapHttpStatus, type HttpResult } from '@betternotify/core/transports';
import type {
  AutosendAddress,
  AutosendErrorResponse,
  AutosendRequest,
  AutosendSuccessResponse,
  AutosendTransportOptions,
} from './types.js';

export type {
  AutosendAddress,
  AutosendErrorResponse,
  AutosendRequest,
  AutosendSuccessResponse,
  AutosendTransportOptions,
} from './types.js';

export { isAutosendRetriable } from './is-retriable.js';

const DEFAULT_BASE_URL = 'https://api.autosend.com';
const DEFAULT_TIMEOUT_MS = 30_000;

const toAutosendAddress = (addr: Address): AutosendAddress => {
  if (typeof addr === 'string') return { email: addr };
  return addr.name ? { email: addr.email, name: addr.name } : { email: addr.email };
};

const buildRequestBody = (
  message: RenderedMessage,
  from: Address,
  to: Address,
): AutosendRequest => {
  const body: AutosendRequest = {
    from: toAutosendAddress(from),
    to: toAutosendAddress(to),
    subject: message.subject,
  };

  if (message.html) body.html = message.html;
  if (message.text) body.text = message.text;

  return body;
};

const errorMessageFromBody = (body: AutosendErrorResponse | undefined, status: number): string => {
  const message = body?.message ?? body?.error;
  if (message) return `Autosend transport: [${status}] ${message}`;
  return `Autosend transport: [${status}] request failed`;
};

/** @experimental Autosend transport using the Autosend HTTP API (`/v1/mails/send`). */
export const autosendTransport = (opts: AutosendTransportOptions) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/v1/mails/send`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'autosend' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
  };

  const sendOne = (
    message: RenderedMessage,
    from: Address,
    to: Address,
  ): Promise<HttpResult<AutosendSuccessResponse, AutosendErrorResponse>> =>
    http.request<AutosendSuccessResponse, AutosendErrorResponse>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(message, from, to)),
    });

  return createTransport({
    name: 'autosend',

    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Autosend transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const from = message.from;
      const recipients = message.to;
      const results = await Promise.all(recipients.map((to) => sendOne(message, from, to)));

      const accepted: string[] = [];
      const rejected: string[] = [];
      const successData: AutosendSuccessResponse[] = [];
      let firstError: NotifyRpcProviderError | undefined;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const recipientAddr = recipients[i];
        if (!result || !recipientAddr) continue;
        const recipient = normalizeAddress(recipientAddr);

        if (result.ok) {
          if (result.data) {
            successData.push(result.data);
            accepted.push(recipient);
          } else {
            rejected.push(recipient);
            if (!firstError) {
              firstError = new NotifyRpcProviderError({
                message: 'Autosend transport: empty response body',
                code: 'PROVIDER',
                provider: 'autosend',
                retriable: true,
                route: ctx.route,
                messageId: ctx.messageId,
              });
            }
          }
          continue;
        }

        rejected.push(recipient);

        if (result.kind === 'network') {
          log.error('Autosend fetch failed', {
            err: result.cause,
            route: ctx.route,
            recipient,
          });

          if (!firstError) {
            firstError = new NotifyRpcProviderError({
              message: `Autosend transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'autosend',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            });
          }

          continue;
        }

        const errBody = result.body ?? undefined;

        const { code, retriable } = mapHttpStatus(result.status);

        const errorMessage = errorMessageFromBody(errBody, result.status);

        log.error(errorMessage, {
          err: { status: result.status, body: errBody },
          route: ctx.route,
          recipient,
        });

        if (!firstError) {
          firstError = new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'autosend',
            httpStatus: result.status,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          });
        }
      }

      if (accepted.length === 0 && firstError) {
        return { ok: false, error: firstError };
      }

      return {
        ok: true,
        data: {
          transportMessageId: successData[0]?.data.emailId,
          accepted,
          rejected,
          raw: successData,
        },
      };
    },
  });
};
