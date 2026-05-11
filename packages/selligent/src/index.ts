import type { Address, RenderedMessage } from '@betternotify/email';
import { createTransport, normalizeAddress } from '@betternotify/email/transports';
import {
  consoleLogger,
  handlePromise,
  NotifyRpcError,
  NotifyRpcProviderError,
} from '@betternotify/core';
import { createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type {
  SelligentAddress,
  SelligentAttachment,
  SelligentErrorResponse,
  SelligentMessageItem,
  SelligentPerSendData,
  SelligentTokenResponse,
  SelligentTransportOptions,
} from './types.js';

export type {
  SelligentAddress,
  SelligentAttachment,
  SelligentErrorResponse,
  SelligentMessageItem,
  SelligentPerSendData,
  SelligentTokenResponse,
  SelligentTransportOptions,
  SelligentOAuthCredentials,
  SelligentMessageContext,
} from './types.js';

export { isSelligentRetriable } from './is-retriable.js';

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface TransportDataMap {
    selligent: import('./types.js').SelligentPerSendData;
  }
}

const DEFAULT_BASE_URL = 'https://sdc.slgnt.eu';
const DEFAULT_AUTH_URL = 'https://auth.slgnt.eu/oauth/token';
const DEFAULT_AUDIENCE = 'https://sdc.slgnt.eu';
const DEFAULT_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

const toBase64 = (content: Buffer | string): string => {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(content).toString('base64');
};

const toSelligentAddress = (addr: Address): SelligentAddress => {
  if (typeof addr === 'string') return { alias: '', address: addr };
  return { alias: addr.name ?? '', address: addr.email };
};

const toAttachments = (
  attachments: NonNullable<RenderedMessage['attachments']>,
): SelligentAttachment[] =>
  attachments.map((att) => ({
    file_name: att.filename,
    data: toBase64(att.content),
    mime_type: att.contentType ?? 'application/octet-stream',
  }));

const hasOAuthCredentials = (
  opts: SelligentTransportOptions,
): opts is SelligentTransportOptions & {
  clientId: number;
  clientSecret: string;
  accountId: string;
} => 'clientId' in opts;

const createTokenManager = (opts: SelligentTransportOptions) => {
  if (!hasOAuthCredentials(opts)) {
    return { getToken: opts.getAccessToken };
  }

  const authUrl = opts.authUrl ?? DEFAULT_AUTH_URL;
  const audience = opts.audience ?? DEFAULT_AUDIENCE;
  let cachedToken: string | undefined;
  let expiresAt = 0;

  const getToken = async (): Promise<string> => {
    if (cachedToken && Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return cachedToken;
    }

    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        account_id: opts.accountId,
        grant_type: 'client_credentials',
        audience,
      }),
    });

    if (!res.ok) {
      const [, body] = await handlePromise(res.text());
      throw new NotifyRpcProviderError({
        message: `Selligent transport: OAuth token request failed [${res.status}]${body ? `: ${body}` : ''}`,
        code: 'CONFIG',
        provider: 'selligent',
        httpStatus: res.status,
        retriable: res.status >= 500,
      });
    }

    const data = (await res.json()) as SelligentTokenResponse;
    cachedToken = data.access_token;
    expiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  };

  return { getToken };
};

const buildMessageItems = (
  message: RenderedMessage,
  from: Address,
  ctx: { messageId: string },
  perSend?: SelligentPerSendData,
): SelligentMessageItem[] =>
  message.to.map((to, i) => {
    const item: SelligentMessageItem = {
      reference: perSend?.reference ?? `${ctx.messageId}-${i}`,
      content: {
        html: message.html,
      },
      headers: {
        subject: message.subject,
        to: toSelligentAddress(to),
        from: toSelligentAddress(from),
      },
      context: {
        profile: perSend?.profile ?? normalizeAddress(to),
      },
    };

    if (message.text) item.content.text = message.text;
    if (message.attachments?.length) item.content.attachments = toAttachments(message.attachments);
    if (message.replyTo) item.headers.reply = toSelligentAddress(message.replyTo);

    if (perSend?.list_unsubscribe) item.headers.list_unsubscribe = perSend.list_unsubscribe;
    if (perSend?.tags) item.context.tags = perSend.tags;
    if (perSend?.metadata) item.context.metadata = perSend.metadata;
    if (perSend?.custom_send_time) item.custom_send_time = perSend.custom_send_time;
    if (perSend?.time_to_live) item.time_to_live = perSend.time_to_live;

    return item;
  });

/** @experimental Selligent (Marigold Engage) transport using the SDC transactional email API. */
export const selligentTransport = (opts: SelligentTransportOptions) => {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/email/v1/messages/send`;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'selligent' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  const tokenManager = createTokenManager(opts);

  return createTransport({
    name: 'selligent',

    async verify() {
      const [err, token] = await handlePromise(tokenManager.getToken());
      if (err) {
        return { ok: false, details: err.message };
      }
      return { ok: true, details: { tokenLength: token.length } };
    },

    async send(message, ctx) {
      if (!message.from) {
        throw new NotifyRpcError({
          message:
            'Selligent transport: no "from" address. Set it on the channel default, route `.from()` resolver, or per-call args.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const [tokenErr, token] = await handlePromise(tokenManager.getToken());
      if (tokenErr) {
        if (tokenErr instanceof NotifyRpcProviderError) {
          return { ok: false, error: tokenErr };
        }
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: `Selligent transport: failed to obtain access token: ${tokenErr.message}`,
            code: 'CONFIG',
            provider: 'selligent',
            retriable: true,
            route: ctx.route,
            messageId: ctx.messageId,
            cause: tokenErr,
          }),
        };
      }

      const perSend = ctx.transport?.selligent as SelligentPerSendData | undefined;
      const items = buildMessageItems(message, message.from, ctx, perSend);

      const result = await http.request<unknown, SelligentErrorResponse>(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(items),
      });

      if (!result.ok) {
        if (result.kind === 'network') {
          log.error('Selligent fetch failed', { err: result.cause, route: ctx.route });
          return {
            ok: false,
            error: new NotifyRpcProviderError({
              message: `Selligent transport: ${result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`}`,
              code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
              provider: 'selligent',
              retriable: true,
              route: ctx.route,
              messageId: ctx.messageId,
              cause: result.cause,
            }),
          };
        }

        const errData = result.body ?? ({} as SelligentErrorResponse);
        const { code, retriable } = mapHttpStatus(result.status);
        const errorMessage = `Selligent transport: [${result.status}] ${errData.error_message ?? 'request failed'}`;
        log.error(errorMessage, {
          err: { status: result.status, body: errData },
          route: ctx.route,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: errorMessage,
            code,
            provider: 'selligent',
            httpStatus: result.status,
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      return {
        ok: true,
        data: {
          accepted: message.to.map(normalizeAddress),
          rejected: [],
          raw: items,
        },
      };
    },
  });
};
