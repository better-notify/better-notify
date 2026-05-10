# @betternotify/autosend

[Autosend](https://autosend.com) email transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered emails through the Autosend `POST /v1/mails/send` API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/autosend @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { autosendTransport } from '@betternotify/autosend';

const email = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});
const rpc = createNotify({ channels: { email } });
const catalog = rpc.catalog({
  /* routes */
});

const mail = createClient({
  catalog,
  channels: { email },
  transportsByChannel: {
    email: autosendTransport({
      apiKey: process.env.AUTOSEND_API_KEY!,
    }),
  },
});
```

## Options

| Field    | Type     | Description                                                  |
| -------- | -------- | ------------------------------------------------------------ |
| `apiKey` | `string` | Autosend API key. Required.                                  |
| `baseUrl`| `string` | Override the API base URL. Defaults to `https://api.autosend.com`. |
| `logger` | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.        |
| `http`   | `object` | HTTP behavior options (retry, timeout, hooks).               |

## Caveats

The Autosend `/v1/mails/send` API accepts a single recipient per request. When `to` contains multiple addresses, the transport fans out one HTTP request per recipient and aggregates the results.

`cc`, `bcc`, `replyTo`, custom `headers`, `attachments`, `inlineAssets`, `tags`, and `priority` are not part of the documented Autosend send schema and are dropped. If your use case needs them, use a transport that supports them (e.g. `@betternotify/resend`, `@betternotify/mailchimp`).

## License

MIT
