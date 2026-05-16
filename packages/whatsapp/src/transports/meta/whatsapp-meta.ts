import { consoleLogger, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient } from '@betternotify/core/transports';
import { handlePromise } from '@betternotify/core';
import type { RenderedWhatsApp } from '../../types.js';
import type { WhatsappTransportData, Transport } from '../types.js';
import { validateRenderedWhatsApp } from '../validate-rendered.js';
import type { WhatsappMetaTransportOptions } from './whatsapp-meta.types.js';

type MetaApiSuccess = {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
};

type MetaApiError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
};

type MetaMediaUploadResponse = {
  id: string;
};

const MEDIA_ACTIONS = new Set<string>(['image', 'video', 'audio', 'document']);

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BASE_URL = 'https://graph.facebook.com/v25.0';

const CONFIG_ERROR_CODES = new Set([190, 200, 4]);
const RATE_LIMIT_ERROR_CODES = new Set([130429, 131056]);
const VALIDATION_ERROR_CODES = new Set([
  131026, 131047, 131051, 131009, 100, 132000, 132001, 132005, 132007, 132012,
]);

const mapMetaErrorCode = (
  code: number | undefined,
): { code: 'CONFIG' | 'VALIDATION' | 'PROVIDER' | 'RATE_LIMITED'; retriable: boolean } => {
  if (code !== undefined) {
    if (CONFIG_ERROR_CODES.has(code)) return { code: 'CONFIG', retriable: false };
    if (RATE_LIMIT_ERROR_CODES.has(code)) return { code: 'RATE_LIMITED', retriable: true };
    if (VALIDATION_ERROR_CODES.has(code)) return { code: 'VALIDATION', retriable: false };
  }

  return { code: 'PROVIDER', retriable: true };
};

const hasMediaData = (
  rendered: RenderedWhatsApp,
): rendered is RenderedWhatsApp & { data: Buffer | Uint8Array; mimeType: string } =>
  MEDIA_ACTIONS.has(rendered.action) && 'data' in rendered && rendered.data !== undefined;

const buildMediaRef = (
  mediaIdOrUrl: { id: string } | { link: string },
  rendered: RenderedWhatsApp,
): Record<string, unknown> => {
  const ref: Record<string, unknown> = { ...mediaIdOrUrl };

  if (rendered.action === 'image' || rendered.action === 'video') {
    if ('caption' in rendered && rendered.caption !== undefined) ref.caption = rendered.caption;
  }

  if (rendered.action === 'document') {
    if ('caption' in rendered && rendered.caption !== undefined) ref.caption = rendered.caption;
    if ('filename' in rendered && rendered.filename !== undefined) ref.filename = rendered.filename;
  }

  return ref;
};

const buildPayload = (rendered: RenderedWhatsApp, mediaId?: string): Record<string, unknown> => {
  const base = {
    messaging_product: 'whatsapp' as const,
    recipient_type: 'individual' as const,
    to: rendered.to,
  };

  switch (rendered.action) {
    case 'text':
      return { ...base, type: 'text', text: { body: rendered.body, preview_url: false } };

    case 'image':
    case 'video':
    case 'audio':
    case 'document': {
      const link = 'url' in rendered && rendered.url !== undefined ? rendered.url : '';
      const source = mediaId !== undefined ? { id: mediaId } : { link };
      return { ...base, type: rendered.action, [rendered.action]: buildMediaRef(source, rendered) };
    }

    case 'location': {
      const location: Record<string, unknown> = {
        latitude: rendered.latitude,
        longitude: rendered.longitude,
      };
      if (rendered.name !== undefined) location.name = rendered.name;
      if (rendered.address !== undefined) location.address = rendered.address;
      return { ...base, type: 'location', location };
    }

    case 'reaction':
      return {
        ...base,
        type: 'reaction',
        reaction: { message_id: rendered.messageId, emoji: rendered.emoji },
      };

    case 'interactive': {
      const hasButtons = rendered.buttons && rendered.buttons.length > 0;

      const action: Record<string, unknown> = {};
      let interactiveType = 'list';

      if (hasButtons && rendered.buttons) {
        interactiveType = 'button';
        action.buttons = rendered.buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        }));
      } else if (rendered.sections) {
        interactiveType = 'list';
        action.button = 'Select';
        action.sections = rendered.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => {
            const row: Record<string, unknown> = { id: r.id, title: r.title };
            if (r.description !== undefined) row.description = r.description;
            return row;
          }),
        }));
      }

      const interactive: Record<string, unknown> = {
        type: interactiveType,
        body: { text: rendered.body },
        action,
      };

      if (rendered.header !== undefined) {
        interactive.header = { type: 'text', text: rendered.header };
      }
      if (rendered.footer !== undefined) {
        interactive.footer = { text: rendered.footer };
      }

      return { ...base, type: 'interactive', interactive };
    }

    case 'template': {
      const template: Record<string, unknown> = {
        name: rendered.templateName,
        language: { code: rendered.language },
      };

      if (rendered.components !== undefined) template.components = rendered.components;

      return { ...base, type: 'template', template };
    }

    case 'contacts':
      return {
        ...base,
        type: 'contacts',
        contacts: rendered.contacts.map((c) => {
          const spaceIdx = c.name.formatted.indexOf(' ');
          const derivedFirst =
            spaceIdx > 0 ? c.name.formatted.slice(0, spaceIdx) : c.name.formatted;
          const derivedLast = spaceIdx > 0 ? c.name.formatted.slice(spaceIdx + 1) : undefined;

          const contact: Record<string, unknown> = {
            name: {
              formatted_name: c.name.formatted,
              first_name: c.name.first ?? derivedFirst,
              ...(c.name.last !== undefined || derivedLast !== undefined
                ? { last_name: c.name.last ?? derivedLast }
                : {}),
            },
          };
          if (c.phones) {
            contact.phones = c.phones.map((p) => {
              const phone: Record<string, unknown> = { phone: p.phone };
              if (p.type !== undefined) phone.type = p.type;
              return phone;
            });
          }
          if (c.emails) {
            contact.emails = c.emails.map((e) => {
              const email: Record<string, unknown> = { email: e.email };
              if (e.type !== undefined) email.type = e.type;
              return email;
            });
          }
          return contact;
        }),
      };
  }
};

/**
 * WhatsApp transport using Meta's Cloud API (`graph.facebook.com`).
 *
 * Media (image, video, audio, document) supports two modes:
 *
 * **URL mode** — set `url` on the rendered message. Meta's servers fetch the
 * file from the URL. It must be publicly reachable over HTTPS with a correct
 * `Content-Type` header; otherwise Meta silently rejects the message.
 *
 * **Buffer mode** — set `data` (Buffer/Uint8Array) and `mimeType` on the
 * rendered message. The transport uploads the binary to Meta's media API
 * (`POST /{phoneNumberId}/media`) and references the returned `media_id` in
 * the message. Same two-step flow as Slack's file upload.
 *
 * Supported audio: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`,
 * `audio/ogg; codecs=opus`. Max 16 MB.
 *
 * Supported video: `video/mp4`, `video/3gpp`. Max 16 MB.
 * Only H.264 and audio AAC codecs are supported for video.
 *
 * Supported image: `image/jpeg`, `image/png`. Max 5 MB.
 *
 * Supported document: any valid MIME type. Max 100 MB.
 *
 * **Templates** — set `action: 'template'` with `templateName`, `language`,
 * and an optional `components` array matching Meta's wire shape. Templates
 * must be registered and approved in the Meta Business Manager before use.
 * Parameter mismatches against the registered template surface as
 * `VALIDATION` provider errors with codes 132000–132012.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/overview
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const whatsappMetaTransport = (opts: WhatsappMetaTransportOptions): Transport => {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'whatsapp-meta' });
  const http = createHttpClient({ ...opts.http, timeoutMs });

  const messagesUrl = `${baseUrl}/${opts.phoneNumberId}/messages`;
  const mediaUrl = `${baseUrl}/${opts.phoneNumberId}/media`;

  const uploadMedia = async (data: Buffer | Uint8Array, mimeType: string): Promise<string> => {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    form.append('file', new Blob([ab], { type: mimeType }), `upload.${mimeType.split('/')[1]}`);

    const [err, response] = await handlePromise(
      fetch(mediaUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.accessToken}` },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );

    if (err) {
      const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
      throw new NotifyRpcProviderError({
        message: `WhatsApp media upload: ${isTimeout ? 'request timed out' : `network error: ${err.message}`}`,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
        cause: err,
      });
    }

    if (!response.ok) {
      const [, body] = await handlePromise(response.json());
      const metaError = (body as MetaApiError)?.error;
      const detail = metaError?.message ?? `HTTP ${response.status}`;
      throw new NotifyRpcProviderError({
        message: `WhatsApp media upload: ${detail}`,
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        httpStatus: response.status,
        retriable: response.status >= 500,
      });
    }

    const [, json] = await handlePromise(response.json());
    const mediaResponse = json as MetaMediaUploadResponse | undefined;
    if (!mediaResponse?.id) {
      throw new NotifyRpcProviderError({
        message: 'WhatsApp media upload: missing media ID in response',
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    }

    return mediaResponse.id;
  };

  return createTransport<RenderedWhatsApp, WhatsappTransportData>({
    name: 'whatsapp-meta',

    async send(rendered, ctx) {
      const validationError = validateRenderedWhatsApp(rendered, ctx);
      if (validationError) return { ok: false, error: validationError };

      let mediaId: string | undefined;

      if (hasMediaData(rendered)) {
        log.debug('uploading media to WhatsApp', {
          action: rendered.action,
          mimeType: rendered.mimeType,
          size: rendered.data.byteLength,
          route: ctx.route,
        });
        mediaId = await uploadMedia(rendered.data, rendered.mimeType);
      }

      const payload = buildPayload(rendered, mediaId);

      log.debug('sending WhatsApp message', {
        action: rendered.action,
        to: rendered.to,
        route: ctx.route,
        ...(mediaId !== undefined ? { mediaId } : {}),
      });

      const result = await http.request<MetaApiSuccess, MetaApiError>(messagesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!result.ok) {
        const isNetwork = result.kind === 'network';
        const isTimeout = isNetwork && result.timedOut;

        if (isNetwork) {
          const detail = isTimeout ? 'request timed out' : `network error: ${result.cause.message}`;
          throw new NotifyRpcProviderError({
            message: `WhatsApp Cloud API: ${detail}`,
            code: isTimeout ? 'TIMEOUT' : 'PROVIDER',
            provider: 'whatsapp-meta',
            retriable: true,
            cause: result.cause,
          });
        }

        const metaError = (result.body as MetaApiError)?.error;
        const metaCode = metaError?.code;
        const metaMessage = metaError?.message ?? `HTTP ${result.status} ${result.statusText}`;
        const mapped = mapMetaErrorCode(metaCode);

        log.error('WhatsApp API error', {
          err: new Error(metaMessage),
          route: ctx.route,
          httpStatus: result.status,
          metaCode,
        });

        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: `WhatsApp Cloud API: ${metaMessage}`,
            code: mapped.code,
            provider: 'whatsapp-meta',
            httpStatus: result.status,
            providerCode: metaCode !== undefined ? String(metaCode) : undefined,
            retriable: mapped.retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      if (!result.data) {
        throw new NotifyRpcProviderError({
          message: 'WhatsApp Cloud API: empty response body',
          code: 'PROVIDER',
          provider: 'whatsapp-meta',
          retriable: true,
        });
      }

      const waMessageId = result.data.messages?.[0]?.id;
      const waId = result.data.contacts?.[0]?.wa_id;

      if (!waMessageId) {
        throw new NotifyRpcProviderError({
          message: 'WhatsApp Cloud API: missing message ID in response',
          code: 'PROVIDER',
          provider: 'whatsapp-meta',
          retriable: true,
        });
      }

      return {
        ok: true as const,
        data: {
          messageId: waMessageId,
          ...(waId !== undefined ? { waId } : {}),
        } satisfies WhatsappTransportData,
      };
    },

    async verify() {
      const phoneUrl = `${baseUrl}/${opts.phoneNumberId}`;
      const result = await http.request<Record<string, unknown>>(phoneUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${opts.accessToken}` },
      });

      if (!result.ok) {
        const detail = result.kind === 'network' ? result.cause.message : `HTTP ${result.status}`;

        return { ok: false, details: detail };
      }

      return { ok: true, details: result.data };
    },
  });
};
