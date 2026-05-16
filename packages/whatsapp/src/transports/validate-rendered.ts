import { NotifyRpcError } from '@betternotify/core';
import type { SendContext } from '@betternotify/core';
import type { RenderedWhatsApp } from '../types.js';

const MEDIA_ACTIONS = new Set<RenderedWhatsApp['action']>(['image', 'video', 'audio', 'document']);

/**
 * Provider-agnostic validation for a rendered WhatsApp message.
 *
 * Encodes WhatsApp protocol invariants that hold regardless of the underlying
 * provider (Meta Cloud API, Bird, WaMessenger, etc.):
 *
 * - `to` must be non-empty.
 * - Media messages (image/video/audio/document) must carry either `url` or `data`.
 * - Interactive messages must carry exactly one of `buttons` or `sections`.
 *
 * Returns a `NotifyRpcError` to surface via `{ ok: false, error }`, or
 * `undefined` when the message is valid.
 */
export const validateRenderedWhatsApp = (
  rendered: RenderedWhatsApp,
  ctx: Pick<SendContext, 'route' | 'messageId'>,
): NotifyRpcError | undefined => {
  if (!rendered.to) {
    return new NotifyRpcError({
      message: 'No recipient: "to" must be set in send args',
      code: 'VALIDATION',
      route: ctx.route,
      messageId: ctx.messageId,
    });
  }

  if (MEDIA_ACTIONS.has(rendered.action)) {
    const hasUrl = 'url' in rendered && typeof rendered.url === 'string' && rendered.url.length > 0;
    const hasData = 'data' in rendered && rendered.data !== undefined;

    if (!hasUrl && !hasData) {
      return new NotifyRpcError({
        message: `${rendered.action} message must have either "url" or "data" set`,
        code: 'VALIDATION',
        route: ctx.route,
        messageId: ctx.messageId,
      });
    }
  }

  if (rendered.action === 'interactive') {
    const hasButtons = rendered.buttons && rendered.buttons.length > 0;
    const hasSections = rendered.sections && rendered.sections.length > 0;

    if (hasButtons && hasSections) {
      return new NotifyRpcError({
        message: 'Interactive message cannot have both buttons and sections',
        code: 'VALIDATION',
        route: ctx.route,
        messageId: ctx.messageId,
      });
    }

    if (!hasButtons && !hasSections) {
      return new NotifyRpcError({
        message: 'Interactive message must have either buttons or sections',
        code: 'VALIDATION',
        route: ctx.route,
        messageId: ctx.messageId,
      });
    }
  }

  return undefined;
};
