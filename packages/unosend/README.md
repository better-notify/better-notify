# @betternotify/unosend

[![npm version](https://img.shields.io/npm/v/@betternotify/unosend)](https://www.npmjs.com/package/@betternotify/unosend)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/unosend)](https://www.npmjs.com/package/@betternotify/unosend)
[![license](https://img.shields.io/npm/l/@betternotify/unosend)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

[Unosend](https://www.unosend.co) email transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered emails through the Unosend `POST /emails` API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/unosend @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { unosendTransport } from '@betternotify/unosend';

const email = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});
const rpc = createNotify({ channels: { email } });
const catalog = rpc.catalog({
  /* routes */
});

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: unosendTransport({
      apiKey: process.env.UNOSEND_API_KEY!,
    }),
  },
});
```

## Options

| Field     | Type     | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| `apiKey`  | `string` | Unosend API key. Required.                                       |
| `baseUrl` | `string` | Override the API base URL. Defaults to `https://api.unosend.co`. |
| `logger`  | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.            |
| `http`    | `object` | HTTP behavior options (retry, timeout, hooks).                   |

## Per-send overrides

Pass provider-specific options per send via the `transport` field:

```ts
await mail.welcome.send({
  to: 'user@example.com',
  input: { name: 'Alice' },
  transport: {
    unosend: {
      priority: 'high',
      scheduled_for: '2026-06-01T10:00:00Z',
      tracking: { open: false, click: true },
    },
  },
});
```

## Supported fields

Unosend supports the full `RenderedMessage` surface: `to`, `cc`, `bcc`, `replyTo`, custom `headers`, `attachments`, and `tags`.

## License

MIT
