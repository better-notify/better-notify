import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient } from '@betternotify/core/transports';
import type { RenderedSms, SmsTransportData, Transport } from '@betternotify/sms';
import type { TwilioSmsTransportOptions } from './twilio.types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

type TwilioSuccessResponse = {
  sid: string;
  status: string;
  date_created: string;
  [key: string]: unknown;
};

type TwilioErrorResponse = {
  code: number;
  message: string;
  more_info?: string;
  status?: number;
};

const CONFIG_CODES = new Set([20003, 20005, 20006, 20008]);
const VALIDATION_CODES = new Set([21211, 21612, 21610, 21614, 21217, 21219]);
const RATE_LIMITED_CODES = new Set([14107, 20429, 63018]);

const mapError = (
  twilioCode: number | undefined,
  httpStatus: number,
): { code: 'CONFIG' | 'VALIDATION' | 'RATE_LIMITED' | 'PROVIDER'; retriable: boolean } => {
  if (twilioCode !== undefined) {
    if (CONFIG_CODES.has(twilioCode)) return { code: 'CONFIG', retriable: false };
    if (VALIDATION_CODES.has(twilioCode)) return { code: 'VALIDATION', retriable: false };
    if (RATE_LIMITED_CODES.has(twilioCode)) return { code: 'RATE_LIMITED', retriable: true };
  }
  if (httpStatus === 401 || httpStatus === 403) return { code: 'CONFIG', retriable: false };
  if (httpStatus === 400) return { code: 'VALIDATION', retriable: false };
  if (httpStatus === 429) return { code: 'RATE_LIMITED', retriable: true };
  return { code: 'PROVIDER', retriable: httpStatus >= 500 };
};

const encodeBasicAuth = (accountSid: string, authToken: string): string =>
  btoa(`${accountSid}:${authToken}`);

/**
 * Creates an SMS transport backed by the Twilio Messages API.
 */
export const twilioSmsTransport = (opts: TwilioSmsTransportOptions): Transport => {
  if (!opts.fromNumber && !opts.messagingServiceSid) {
    throw new NotifyRpcError({
      message: 'Twilio transport requires at least one of "fromNumber" or "messagingServiceSid"',
      code: 'CONFIG',
    });
  }

  const baseUrl = opts.baseUrl ?? 'https://api.twilio.com';
  const timeoutMs = opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'twilio' });
  const authHeader = `Basic ${encodeBasicAuth(opts.accountSid, opts.authToken)}`;
  const messagesUrl = `${baseUrl}/2010-04-01/Accounts/${opts.accountSid}/Messages.json`;
  const http = createHttpClient({ ...opts.http, timeoutMs });

  return createTransport<RenderedSms, SmsTransportData>({
    name: 'twilio-sms',

    async send(rendered, ctx) {
      if (!rendered.to) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Twilio transport: "to" phone number is required',
            code: 'VALIDATION',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const params = new URLSearchParams();
      params.set('To', rendered.to);
      params.set('Body', rendered.body);

      if (opts.messagingServiceSid) {
        params.set('MessagingServiceSid', opts.messagingServiceSid);
      } else if (opts.fromNumber) {
        params.set('From', opts.fromNumber);
      }

      const result = await http.request<TwilioSuccessResponse, TwilioErrorResponse>(messagesUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Twilio fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Twilio transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'twilio',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body as TwilioErrorResponse;
        const { code, retriable } = mapError(errData.code, result.status);
        const errorMessage = `Twilio transport: ${errData.message ?? `HTTP ${result.status}`}`;
        log.error(errorMessage, {
          err: { status: result.status, code: errData.code, message: errData.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'twilio',
            httpStatus: result.status,
            providerCode: errData.code,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const successData = result.data as TwilioSuccessResponse;
      return {
        ok: true as const,
        data: {
          messageId: successData.sid,
          provider: 'twilio',
        } satisfies SmsTransportData,
      };
    },

    async verify() {
      const accountUrl = `${baseUrl}/2010-04-01/Accounts/${opts.accountSid}.json`;
      const result = await http.request<Record<string, unknown>>(accountUrl, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });

      if (!result.ok) {
        return {
          ok: false,
          details: result.kind === 'network' ? result.cause.message : `HTTP ${result.status}`,
        };
      }

      const json = result.data as Record<string, unknown>;
      return {
        ok: true,
        details: {
          friendlyName: json.friendly_name,
          status: json.status,
        },
      };
    },
  });
};
