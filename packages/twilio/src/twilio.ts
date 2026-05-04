import { consoleLogger, handlePromise, NotifyRpcError } from '@betternotify/core';
import { createTransport } from '@betternotify/core/transports';
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

const mapErrorCode = (
  twilioCode: number | undefined,
  httpStatus: number,
): 'CONFIG' | 'VALIDATION' | 'RATE_LIMITED' | 'PROVIDER' => {
  if (twilioCode !== undefined) {
    if (CONFIG_CODES.has(twilioCode)) return 'CONFIG';
    if (VALIDATION_CODES.has(twilioCode)) return 'VALIDATION';
    if (RATE_LIMITED_CODES.has(twilioCode)) return 'RATE_LIMITED';
  }
  if (httpStatus === 401 || httpStatus === 403) return 'CONFIG';
  if (httpStatus === 400) return 'VALIDATION';
  if (httpStatus === 429) return 'RATE_LIMITED';
  return 'PROVIDER';
};

const encodeBasicAuth = (accountSid: string, authToken: string): string =>
  btoa(`${accountSid}:${authToken}`);

export const twilioSmsTransport = (opts: TwilioSmsTransportOptions): Transport => {
  if (!opts.fromNumber && !opts.messagingServiceSid) {
    throw new NotifyRpcError({
      message: 'Twilio transport requires at least one of "fromNumber" or "messagingServiceSid"',
      code: 'CONFIG',
    });
  }

  const baseUrl = opts.baseUrl ?? 'https://api.twilio.com';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'twilio' });
  const authHeader = `Basic ${encodeBasicAuth(opts.accountSid, opts.authToken)}`;
  const messagesUrl = `${baseUrl}/2010-04-01/Accounts/${opts.accountSid}/Messages.json`;

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

      const [fetchErr, response] = await handlePromise(
        fetch(messagesUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }),
      );

      if (fetchErr) {
        const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError';
        log.error('Twilio fetch failed', { err: fetchErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: `Twilio transport: ${isTimeout ? 'request timed out' : `network error: ${fetchErr.message}`}`,
            code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: fetchErr,
          }),
        };
      }

      const [parseErr, data] = await handlePromise(
        response.json() as Promise<TwilioSuccessResponse | TwilioErrorResponse>,
      );

      if (parseErr) {
        log.error('Twilio response parse failed', { err: parseErr, route: ctx.route });
        return {
          ok: false,
          error: new NotifyRpcError({
            message: 'Twilio transport: failed to parse response',
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
            cause: parseErr,
          }),
        };
      }

      if (!response.ok) {
        const errData = data as TwilioErrorResponse;
        const code = mapErrorCode(errData.code, response.status);
        const errorMessage = `Twilio transport: ${errData.message ?? `HTTP ${response.status}`}`;
        log.error(errorMessage, {
          err: { status: response.status, code: errData.code, message: errData.message },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcError({
            message: errorMessage,
            code,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const successData = data as TwilioSuccessResponse;
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

      const [fetchErr, response] = await handlePromise(
        fetch(accountUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { Authorization: authHeader },
        }),
      );

      if (fetchErr) {
        return { ok: false, details: fetchErr.message };
      }

      const [parseErr, json] = await handlePromise(
        response.json() as Promise<Record<string, unknown>>,
      );

      if (parseErr || !response.ok) {
        return { ok: false, details: parseErr?.message ?? `HTTP ${response.status}` };
      }

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
