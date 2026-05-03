import { consoleLogger, NotifyRpcError } from '@betternotify/core';
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

const mapErrorCode = (error: string): 'CONFIG' | 'VALIDATION' | 'PROVIDER' => {
  if (CONFIG_ERRORS.has(error)) return 'CONFIG';
  if (VALIDATION_ERRORS.has(error)) return 'VALIDATION';
  return 'PROVIDER';
};

export const slackTransport = (opts: SlackTransportOptions): Transport => {
  const baseUrl = opts.baseUrl ?? 'https://slack.com/api';
  const log = (opts.logger ?? consoleLogger()).child({ component: 'slack' });

  const callApi = async (
    method: string,
    body: Record<string, unknown>,
    contentType: 'json' | 'form' = 'json',
  ): Promise<SlackApiResponse> => {
    const isForm = contentType === 'form';
    const response = await fetch(`${baseUrl}/${method}`, {
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
    return (await response.json()) as SlackApiResponse;
  };

  const throwApiError = (
    method: string,
    error: string,
    ctx: { route: string; messageId: string },
  ): never => {
    const code = mapErrorCode(error);
    log.error('Slack API error', { err: new Error(error), route: ctx.route });
    throw new NotifyRpcError({
      message: `Slack ${method} failed: ${error}`,
      code,
      route: ctx.route,
      messageId: ctx.messageId,
    });
  };

  return {
    name: 'slack',

    async send(rendered: RenderedSlack, ctx) {
      const channel = rendered.to ?? opts.defaultChannel;

      if (!channel) {
        throw new NotifyRpcError({
          message:
            'No channel resolved: set "to" in send args or "defaultChannel" in transport options',
          code: 'VALIDATION',
          route: ctx.route,
          messageId: ctx.messageId,
        });
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
          throwApiError(
            'files.getUploadURLExternal',
            uploadUrlResponse.error ?? 'unknown_error',
            ctx,
          );
        }

        const uploadUrl = uploadUrlResponse.upload_url;
        const fileId = uploadUrlResponse.file_id;

        if (!uploadUrl || !fileId) {
          throw new NotifyRpcError({
            message: 'Slack files.getUploadURLExternal returned incomplete upload metadata',
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
          });
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: rendered.file.data,
        });

        if (!uploadResponse.ok) {
          throw new NotifyRpcError({
            message: `Slack file upload failed with HTTP ${uploadResponse.status}`,
            code: 'PROVIDER',
            route: ctx.route,
            messageId: ctx.messageId,
          });
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
          throwApiError(
            'files.completeUploadExternal',
            completeResponse.error ?? 'unknown_error',
            ctx,
          );
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
        throwApiError('chat.postMessage', json.error ?? 'unknown_error', ctx);
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
  };
};
