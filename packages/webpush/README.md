# @betternotify/webpush

[![npm version](https://img.shields.io/npm/v/@betternotify/webpush)](https://www.npmjs.com/package/@betternotify/webpush)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/webpush)](https://www.npmjs.com/package/@betternotify/webpush)
[![license](https://img.shields.io/npm/l/@betternotify/webpush)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

Web Push channel and VAPID transport for [Better-Notify](https://github.com/better-notify/better-notify). Send push notifications to any browser via the [VAPID protocol](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) (RFC 8291 + RFC 8292).

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/webpush @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { webPushChannel } from '@betternotify/webpush';
import { vapidTransport } from '@betternotify/webpush/transports';
import { z } from 'zod';

const webpush = webPushChannel();
const rpc = createNotify({ channels: { webpush } });

const catalog = rpc.catalog({
  newMessage: rpc
    .webpush()
    .input(z.object({ from: z.string(), preview: z.string() }))
    .title(({ input }) => `New message from ${input.from}`)
    .body(({ input }) => input.preview)
    .icon('/icons/message.png')
    .tag('new-message'),
});

const notify = createClient({
  catalog,
  transportsByChannel: {
    webpush: vapidTransport({
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: 'mailto:hello@example.com',
    }),
  },
});

await notify.newMessage.send({
  to: {
    endpoint: 'https://push.example.com/v1/...',
    keys: { p256dh: '...', auth: '...' },
  },
  input: { from: 'Alice', preview: 'See you tomorrow' },
});
```

## Generating VAPID keys

```ts
import { generateVapidKeys } from '@betternotify/webpush';

const { publicKey, privateKey } = await generateVapidKeys();
```

Store these in environment variables. Regenerating keys invalidates all existing subscriptions.

## Builder slots

| Slot      | Required | Type                                                              |
| --------- | -------- | ----------------------------------------------------------------- |
| `title`   | yes      | `string \| ({input}) => string`                                   |
| `body`    | yes      | `string \| ({input}) => string`                                   |
| `icon`    | no       | `string \| ({input}) => string`                                   |
| `badge`   | no       | `string \| ({input}) => string`                                   |
| `image`   | no       | `string \| ({input}) => string`                                   |
| `tag`     | no       | `string \| ({input}) => string`                                   |
| `data`    | no       | `Record<string, unknown> \| ({input}) => Record<string, unknown>` |
| `actions` | no       | `WebPushAction[] \| ({input}) => WebPushAction[]`                 |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.newMessage.send({
  to: WebPushSubscription | ReadonlyArray<WebPushSubscription>,
  input: TInput,
});
```

Where `WebPushSubscription` is `{ endpoint: string; keys: { p256dh: string; auth: string } }` — the object returned by the browser's `PushManager.subscribe()`.

## Options

| Field        | Type     | Description                                                                                   |
| ------------ | -------- | --------------------------------------------------------------------------------------------- |
| `publicKey`  | `string` | Base64url-encoded VAPID public key (from `generateVapidKeys()`). Required.                    |
| `privateKey` | `string` | Base64url-encoded VAPID private key (from `generateVapidKeys()`). Required.                   |
| `subject`    | `string` | Contact URI for the application server (`mailto:` or `https://`). Required.                   |
| `ttl`        | `number` | Time-to-live in seconds for the push message. Defaults to `2419200` (28 days).                |
| `urgency`    | `string` | Push message urgency: `'very-low'`, `'low'`, `'normal'`, or `'high'`. Defaults to `'normal'`. |
| `logger`     | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.                                         |
| `http`       | `object` | HTTP behavior options (retry, timeout, hooks).                                                |

## Transports

```ts
import {
  vapidTransport,
  mockWebPushTransport,
  multiTransport,
  createTransport,
} from '@betternotify/webpush/transports';
```

- `vapidTransport(opts)` — VAPID transport (RFC 8291 + RFC 8292). Uses WebCrypto for encryption and signing; no native dependencies. Works in Node 22+ and Cloudflare Workers.
- `mockWebPushTransport()` — records sent messages for tests.
- `multiTransport(opts)` / `createTransport(opts)` — transport factories typed to `RenderedWebPush`.

## Example

See [`examples/web-push`](../../examples/web-push) for a working Hono server that sends push notifications with VAPID.

## Caveats

VAPID keys are generated as an ECDSA P-256 key pair. The `publicKey` is the 65-byte uncompressed point encoded as base64url; the `privateKey` is the 32-byte `d` parameter encoded as base64url. Regenerating keys invalidates all existing browser subscriptions. Reuse the same key pair across deploys.

When a push service returns `404` or `410`, the transport marks the subscription as `gone`. Remove these subscriptions from storage to avoid repeated delivery failures.

The transport sends to all subscriptions in parallel via `Promise.all`. If every subscription fails, the result is a non-retriable error. Partial success (some subscriptions delivered, some failed) is reported as `ok: true` with per-subscription results in `data.results`.

## License

MIT
