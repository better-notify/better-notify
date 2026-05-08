# @betternotify/mailchimp

Mailchimp Transactional (Mandrill) email transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered emails through the Mandrill `/messages/send` API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/mailchimp @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { mailchimpTransport } from '@betternotify/mailchimp';

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
    email: mailchimpTransport({
      apiKey: process.env.MANDRILL_API_KEY!,
    }),
  },
});
```

## Options

| Field    | Type     | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `apiKey` | `string` | Mandrill API key. Required.                    |
| `http`   | `object` | HTTP behavior options (retry, timeout, hooks). |

## License

MIT
