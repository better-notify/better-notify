# @betternotify/resend

[![npm version](https://img.shields.io/npm/v/@betternotify/resend)](https://www.npmjs.com/package/@betternotify/resend)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/resend)](https://www.npmjs.com/package/@betternotify/resend)
[![license](https://img.shields.io/npm/l/@betternotify/resend)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

[Resend](https://resend.com) email transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered emails through the Resend `POST /emails` API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/resend @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { resendTransport } from '@betternotify/resend';

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
    email: resendTransport({
      apiKey: process.env.RESEND_API_KEY!,
    }),
  },
});
```

## Options

| Field     | Type     | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| `apiKey`  | `string` | Resend API key. Required.                                        |
| `baseUrl` | `string` | Override the API base URL. Defaults to `https://api.resend.com`. |
| `logger`  | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.            |
| `http`    | `object` | HTTP behavior options (retry, timeout, hooks).                   |

## Supported fields

Resend supports the full `RenderedMessage` surface: `to`, `cc`, `bcc`, `replyTo`, custom `headers`, `attachments`, and `tags`.

## License

MIT
