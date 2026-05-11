# @betternotify/onesignal

[OneSignal](https://onesignal.com) push, email, and SMS transports for [Better-Notify](https://github.com/better-notify/better-notify). Delivers rendered messages through the OneSignal `POST /notifications` API across all three channels.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/onesignal @betternotify/core @betternotify/email @betternotify/push @betternotify/sms
```

Only the channel packages you actually use are required — install only `@betternotify/push` if you're sending push notifications, for example.

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { pushChannel } from '@betternotify/push';
import { smsChannel } from '@betternotify/sms';
import {
  onesignalPushTransport,
  onesignalEmailTransport,
  onesignalSmsTransport,
} from '@betternotify/onesignal';

const email = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});
const push = pushChannel();
const sms = smsChannel();

const rpc = createNotify({ channels: { email, push, sms } });
const catalog = rpc.catalog({
  /* routes */
});

const shared = {
  appId: process.env.ONESIGNAL_APP_ID!,
  apiKey: process.env.ONESIGNAL_API_KEY!,
};

const notify = createClient({
  catalog,
  channels: { email, push, sms },
  transportsByChannel: {
    email: onesignalEmailTransport(shared),
    push: onesignalPushTransport(shared),
    sms: onesignalSmsTransport({ ...shared, from: '+15555550000' }),
  },
});
```

## Options

All three transports share `OneSignalTransportOptions`. The SMS transport also accepts an optional `from` field for `sms_from`.

| Field     | Type     | Description                                                            |
| --------- | -------- | ---------------------------------------------------------------------- |
| `appId`   | `string` | OneSignal App ID (UUID v4). Required.                                  |
| `apiKey`  | `string` | OneSignal REST API key (sent as `Authorization: Key <apiKey>`). Required. |
| `baseUrl` | `string` | Override the API base URL. Defaults to `https://api.onesignal.com`.    |
| `logger`  | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.                  |
| `http`    | `object` | HTTP behavior options (retry, timeout, hooks).                         |
| `from`    | `string` | SMS only — phone number or Messaging Service SID for `sms_from`.       |

## Endpoints

| Transport                  | OneSignal endpoint                              |
| -------------------------- | ----------------------------------------------- |
| `onesignalPushTransport`   | `POST /notifications?c=push`                    |
| `onesignalEmailTransport`  | `POST /notifications?c=email`                   |
| `onesignalSmsTransport`    | `POST /notifications?c=sms`                     |

## Caveats

OneSignal is a notification platform first — its email and SMS APIs are oriented toward broadcast and campaigns, not deep transactional metadata. The following `RenderedMessage` fields are not part of OneSignal's documented send schema and are silently dropped: `cc`, `bcc`, custom `headers`, `attachments`, `inlineAssets`, `tags`, and `priority`. If you need them, prefer a dedicated email provider transport (e.g. `@betternotify/resend`, `@betternotify/mailchimp`).

When all targeted subscriptions / addresses / phone numbers are invalid or unsubscribed, OneSignal returns `HTTP 200` with `id: ""`. The transport surfaces this as a non-retriable `VALIDATION` error.

Push delivery uses `include_subscription_ids` — pass OneSignal subscription IDs (formerly player IDs) via the channel `to`.

## License

MIT
