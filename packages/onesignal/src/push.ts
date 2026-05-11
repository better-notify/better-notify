import type { AnyCatalog } from '@betternotify/core';
import { createTransport } from '@betternotify/core/transports';
import type { RenderedPush, PushTransportData, Transport } from '@betternotify/push';
import type { OneSignalPushTransportOptions } from './types.js';
import { createOneSignalSend } from './shared.js';

/**
 * Creates a push notification transport backed by the OneSignal Notifications API.
 */
export const onesignalPushTransport = <TCatalog extends AnyCatalog = AnyCatalog>(
  opts: OneSignalPushTransportOptions<TCatalog>,
): Transport =>
  createTransport<RenderedPush, PushTransportData>(
    createOneSignalSend(
      {
        channel: 'push',
        label: 'push',
        emptyIdMessage:
          'OneSignal push transport: all targeted subscriptions are invalid or unsubscribed',
        buildBody: (rendered) => {
          const body: Record<string, unknown> = {
            contents: { en: rendered.body },
            headings: { en: rendered.title },
          };

          if (rendered.data) {
            body.custom_data = rendered.data;
          }

          if (rendered.badge !== undefined) {
            body.ios_badgeType = 'SetTo';
            body.ios_badgeCount = rendered.badge;
          }

          if (rendered.to !== undefined) {
            body.include_subscription_ids = Array.isArray(rendered.to)
              ? rendered.to
              : [rendered.to];
          }

          return body;
        },
        mapSuccess: (data) => ({
          messageId: data.id,
          provider: 'onesignal' as const,
        }),
      },
      opts,
    ),
  );
