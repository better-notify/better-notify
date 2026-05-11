import type { AnyCatalog } from '@betternotify/core';
import { createTransport, normalizeAddress } from '@betternotify/email/transports';
import type { Transport } from '@betternotify/email/transports';
import type { OneSignalEmailTransportOptions } from './types.js';
import { createOneSignalSend } from './shared.js';

/**
 * Creates an email transport backed by the OneSignal Notifications API.
 */
export const onesignalEmailTransport = <TCatalog extends AnyCatalog = AnyCatalog>(
  opts: OneSignalEmailTransportOptions<TCatalog>,
): Transport =>
  createTransport(
    createOneSignalSend(
      {
        channel: 'email',
        label: 'email',
        emptyIdMessage:
          'OneSignal email transport: all targeted addresses are invalid or unsubscribed',
        buildBody: (rendered) => {
          const body: Record<string, unknown> = {
            email_subject: rendered.subject,
            email_body: rendered.html,
            email_to: rendered.to.map(normalizeAddress),
          };

          if (rendered.from) {
            const from = rendered.from;
            body.email_from_address = normalizeAddress(from);
            if (typeof from !== 'string' && from.name) body.email_from_name = from.name;
          }

          if (rendered.replyTo) body.email_reply_to_address = normalizeAddress(rendered.replyTo);

          return body;
        },
        mapSuccess: (data, rendered) => ({
          transportMessageId: data.id,
          accepted: rendered.to.map(normalizeAddress),
          rejected: [] as string[],
          raw: data,
        }),
      },
      opts,
    ),
  );
