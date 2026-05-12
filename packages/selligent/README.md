# @betternotify/selligent

[Selligent (Marigold Engage)](https://www.marigold.com/products/marigold-engage) transactional email transport for [Better-Notify](https://github.com/better-notify/better-notify). Delivers rendered emails through the Selligent Delivery Cloud (SDC) `POST /email/v1/messages/send` API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/selligent @betternotify/core @betternotify/email
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { selligentTransport } from '@betternotify/selligent';

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
    email: selligentTransport({
      clientId: Number(process.env.SELLIGENT_CLIENT_ID!),
      clientSecret: process.env.SELLIGENT_CLIENT_SECRET!,
      accountId: process.env.SELLIGENT_ACCOUNT_ID!,
    }),
  },
});
```

Alternatively, if you already manage OAuth tokens externally:

```ts
selligentTransport({
  getAccessToken: () => myTokenManager.getToken(),
});
```

## Options

| Field            | Type                    | Description                                                                         |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `clientId`       | `number`                | Selligent OAuth client ID. Required (unless using `getAccessToken`).                |
| `clientSecret`   | `string`                | Selligent OAuth client secret. Required (unless using `getAccessToken`).            |
| `accountId`      | `string`                | Selligent account ID. Required (unless using `getAccessToken`).                     |
| `getAccessToken` | `() => Promise<string>` | Provide your own token. Mutually exclusive with OAuth credentials.                  |
| `baseUrl`        | `string`                | Override the SDC API base URL. Defaults to `https://sdc.slgnt.eu`.                  |
| `authUrl`        | `string`                | Override the OAuth token endpoint. Defaults to `https://auth.slgnt.eu/oauth/token`. |
| `audience`       | `string`                | Override the OAuth audience. Defaults to `https://sdc.slgnt.eu`.                    |
| `logger`         | `object`                | Optional `LoggerLike`. Defaults to `consoleLogger()`.                               |
| `http`           | `object`                | HTTP behavior options (retry, timeout, hooks).                                      |

## Authentication

Unlike API-key-based transports, Selligent uses **OAuth 2.0 client credentials**. The transport handles token management automatically — it fetches a token before the first send, caches it, and refreshes it when it's about to expire (within 60 seconds of expiry).

The `verify()` method tests credentials by attempting a token fetch without sending any email.

## Per-send overrides

Pass Selligent-specific fields per-send via the `transport` key in `.send()`:

```ts
await mail.welcome.send({
  to: 'user@example.com',
  input: { name: 'Jane' },
  transport: {
    selligent: {
      profile: 'crm-id-123',
      tags: ['campaign-spring'],
      metadata: '{"ref": 123}',
      list_unsubscribe: '<https://example.com/unsub>',
      custom_send_time: '2025-09-02T12:00:00',
      time_to_live: 'P2D',
    },
  },
});
```

## Caveats

SDC sends message content without any modifications — it does not inject tracking pixels or rewrite links. Open/click tracking must be implemented by the sender.

The following `RenderedMessage` fields are not part of SDC's send schema and are silently dropped: `cc`, `bcc`, custom `headers`, `tags`, `priority`, and `inlineAssets`.

## License

MIT
