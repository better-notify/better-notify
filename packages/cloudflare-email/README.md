# @betternotify/cloudflare-email

[![npm version](https://img.shields.io/npm/v/@betternotify/cloudflare-email)](https://www.npmjs.com/package/@betternotify/cloudflare-email)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/cloudflare-email)](https://www.npmjs.com/package/@betternotify/cloudflare-email)
[![license](https://img.shields.io/npm/l/@betternotify/cloudflare-email)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

[Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered emails through the Cloudflare Email Sending API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/cloudflare-email @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { cloudflareEmailTransport } from '@betternotify/cloudflare-email';

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
    email: cloudflareEmailTransport({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    }),
  },
});
```

## Options

| Field       | Type     | Description                                                          |
| ----------- | -------- | -------------------------------------------------------------------- |
| `accountId` | `string` | Cloudflare account ID. Required.                                     |
| `apiToken`  | `string` | Cloudflare API token with email sending permissions. Required.       |
| `baseUrl`   | `string` | Override the API base URL. Defaults to `https://api.cloudflare.com`. |
| `logger`    | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.                |
| `http`      | `object` | HTTP behavior options (retry, timeout, hooks).                       |

## Caveats

The Cloudflare Email Sending API does not support `tags`, `priority`, or `inlineAssets` from `RenderedMessage` — these fields are silently dropped. `cc`, `bcc`, `replyTo`, custom `headers`, and `attachments` are fully supported.

## License

MIT
