import { consoleLogger, handlePromise, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient } from '@betternotify/core/transports';
import type { RenderedSlack } from '../types.js';
import type { SlackTransportData, Transport } from './types.js';
import type { SlackTransportOptions } from './slack.types.js';

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  file_id?: string;
  upload_url?: string;
  files?: { id: string; title?: string }[];
  [key: string]: unknown;
};

const DEFAULT_TIMEOUT_MS = 30_000;

const CONFIG_ERRORS = new Set([
  'invalid_auth',
  'token_revoked',
  'not_authed',
  'account_inactive',
  'missing_scope',
]);

const VALIDATION_ERRORS = new Set([
  'channel_not_found',
  'no_text',
  'invalid_blocks',
  'invalid_arguments',
  'msg_too_long',
]);

const mapError = (error: string): { code: 'CONFIG' | 'VALIDATION' | 'PROVIDER'; retriable: boolean } => {
  if (CONFIG_ERRORS.has(error)) return { code: 'CONFIG', retriable: false };
  if (VALIDATION_ERRORS.has(error)) return { code: 'VALIDATION', retriable: false };
  return { code: 'PROVIDER', retriable: true };
};

export const slackTransport = (opts: SlackTransportOptions): Transport => {
  const baseUrl = opts.baseUrl ?? 'https://slack.com/api';
  const timeoutMs = opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'slack' });
  const http = createHttpClient({ ...opts.http, timeoutMs });

  const callApi = async (
    method: string,
    body: Record<string, unknown>,
    contentType: 'json' | 'form' = 'json',
  ): Promise<SlackApiResponse> => {
    const isForm = contentType === 'form';
    const result = await http.request<SlackApiResponse>(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      body: isForm
        ? new URLSearchParams(
            Object.entries(body).map(([k, v]): [string, string] => [k, String(v)]),
          ).toString()
        : JSON.stringify(body),
    });

    if (!result.ok) {
      const isTimeout = result.kind === 'network' && result.timedOut;
      const isNetwork = result.kind === 'network';
      const detail = isNetwork
        ? isTimeout
          ? 'request timed out'
          : `network error: ${result.cause.message}`
        : `HTTP ${result.status} ${result.statusText}: ${JSON.stringify(result.body)}`;
      throw new NotifyRpcProviderError({
        message: `Slack ${method}: ${detail}`,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
        provider: 'slack',
        httpStatus: isNetwork ? undefined : result.status,
        retriable: true,
        cause: isNetwork ? result.cause : undefined,
      });
    }

    if (!result.data) {
      throw new NotifyRpcProviderError({
        message: `Slack ${method}: empty response body`,
        code: 'PROVIDER',
        provider: 'slack',
        retriable: true,
      });
    }

    return result.data as SlackApiResponse;
  };

  const buildError = (
    method: string,
    error: string,
    ctx: { route: string; messageId: string },
  ): NotifyRpcProviderError => {
    const { code, retriable } = mapError(error);
    log.error('Slack API error', { err: new Error(error), route: ctx.route });
    return new NotifyRpcProviderError({
      message: `Slack ${method} failed: ${error}`,
      code,
      provider: 'slack',
      providerCode: error,
      retriable,
      route: ctx.route,
      messageId: ctx.messageId,
    });
  };

  return createTransport<RenderedSlack, SlackTransportData>({
    name: 'slack',

    async send(rendered, ctx) {
      const channel = rendered.to ?? opts.defaultChannel;

      if (!channel) {
        return {
          ok: false,
          error: new NotifyRpcError({
            message:
              'No channel resolved: set "to" in send args or "defaultChannel" in transport options',
            code: 'VALIDATION',
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      if (rendered.file) {
        log.debug('uploading file to Slack', { filename: rendered.file.filename, channel });

        const uploadUrlResponse = await callApi(
          'files.getUploadURLExternal',
          {
            filename: rendered.file.filename,
            length: rendered.file.data.byteLength,
            ...(rendered.file.altText ? { alt_txt: rendered.file.altText } : {}),
          },
          'form',
        );

        if (!uploadUrlResponse.ok) {
          return {
            ok: false,
            error: buildError(
              'files.getUploadURLExternal',
              uploadUrlResponse.error ?? 'unknown_error',
              ctx,
            ),
          };
        }

        const uploadUrl = uploadUrlResponse.upload_url;
        const fileId = uploadUrlResponse.file_id;

        if (!uploadUrl || !fileId) {
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: 'Slack files.getUploadURLExternal returned incomplete upload metadata',
              code: 'PROVIDER',
              provider: 'slack',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
            }),
          };
        }

        const [uploadErr, uploadResponse] = await handlePromise(
          fetch(uploadUrl, {
            method: 'POST',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'Content-Type': 'application/octet-stream' },
            body: rendered.file.data as RequestInit['body'],
          }),
        );

        if (uploadErr) {
          const isTimeout = uploadErr.name === 'AbortError' || uploadErr.name === 'TimeoutError';
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Slack file upload: ${isTimeout ? 'request timed out' : `network error: ${uploadErr.message}`}`,
              code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
              provider: 'slack',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: uploadErr,
            }),
          };
        }

        if (!uploadResponse.ok) {
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Slack file upload failed with HTTP ${uploadResponse.status}`,
              code: 'PROVIDER',
              provider: 'slack',
              httpStatus: uploadResponse.status,
              retriable: uploadResponse.status >= 500,
              route: ctx.route,
              messageId: ctx.messageId,
            }),
          };
        }

        const completeBody: Record<string, unknown> = {
          files: [{ id: fileId, title: rendered.file.title ?? rendered.file.filename }],
          channel_id: channel,
        };

        if (rendered.text) {
          completeBody.initial_comment = rendered.text;
        }

        if (rendered.threadTs) {
          completeBody.thread_ts = rendered.threadTs;
        }

        const completeResponse = await callApi('files.completeUploadExternal', completeBody);

        if (!completeResponse.ok) {
          return {
            ok: false,
            error: buildError(
              'files.completeUploadExternal',
              completeResponse.error ?? 'unknown_error',
              ctx,
            ),
          };
        }

        return {
          ok: true as const,
          data: {
            ts: completeResponse.ts ?? '',
            channel,
          } satisfies SlackTransportData,
        };
      }

      const body: Record<string, unknown> = {
        channel,
        text: rendered.text,
      };

      if (rendered.blocks) {
        body.blocks = rendered.blocks;
      }

      if (rendered.threadTs) {
        body.thread_ts = rendered.threadTs;
      }

      log.debug('calling Slack API', { method: 'chat.postMessage', channel });

      const json = await callApi('chat.postMessage', body);

      if (!json.ok) {
        return {
          ok: false,
          error: buildError('chat.postMessage', json.error ?? 'unknown_error', ctx),
        };
      }

      return {
        ok: true as const,
        data: {
          ts: json.ts ?? '',
          channel: json.channel ?? '',
        } satisfies SlackTransportData,
      };
    },

    async verify() {
      const json = await callApi('auth.test', {});

      if (!json.ok) {
        return { ok: false, details: json.error ?? 'unknown_error' };
      }

      const { ok: _ok, ...details } = json;
      return { ok: true, details };
    },
  });
};
