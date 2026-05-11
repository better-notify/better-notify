import type { AnyCatalog } from '@betternotify/core';
import { createTransport } from '@betternotify/core/transports';
import type { RenderedSms, SmsTransportData, Transport } from '@betternotify/sms';
import type { OneSignalSmsTransportOptions } from './types.js';
import { createOneSignalSend } from './shared.js';

/**
 * Creates an SMS transport backed by the OneSignal Notifications API.
 */
export const onesignalSmsTransport = <TCatalog extends AnyCatalog = AnyCatalog>(
  opts: OneSignalSmsTransportOptions<TCatalog>,
): Transport =>
  createTransport<RenderedSms, SmsTransportData>(
    createOneSignalSend(
      {
        channel: 'sms',
        label: 'SMS',
        emptyIdMessage:
          'OneSignal SMS transport: all targeted phone numbers are invalid or unsubscribed',
        buildBody: (rendered) => {
          const body: Record<string, unknown> = {
            contents: { en: rendered.body },
            target_channel: 'sms',
          };

          if (rendered.to !== undefined) body.include_phone_numbers = [rendered.to];
          if (opts.from !== undefined) body.sms_from = opts.from;

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
