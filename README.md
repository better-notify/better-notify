<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="libs/ui/src/assets/logo-stacked-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="libs/ui/src/assets/logo-stacked.svg">
    <img alt="Better-Notify" src="libs/ui/src/assets/logo-stacked.svg" width="268">
  </picture>
</p>

<p align="center">End-to-end typed notification infrastructure for Node.js and Bun.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@betternotify/core"><img src="https://img.shields.io/npm/v/@betternotify/core?label=npm&color=3a5a8c" alt="npm version"></a>
  <a href="https://github.com/better-notify/better-notify/blob/main/LICENSE"><img src="https://img.shields.io/github/license/better-notify/better-notify?color=3a5a8c" alt="license"></a>
  <img src="https://img.shields.io/node/v/@betternotify/core?color=3a5a8c" alt="node version">
</p>

<p align="center">
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://better-notify.com/blog">Blog</a> ·
  <a href="https://better-notify.com/docs/changelog">Changelog</a>
</p>

<br>

## Why Better-Notify?

- **Typed end-to-end** — one catalog type drives the client, queue worker, and webhook router. Schema and template can't silently drift.
- **Multi-channel** — email, SMS, push, Slack, Discord, Telegram, and more from the same pipeline. Define once, send anywhere.
- **Zero lock-in** — swap transports (SMTP, Resend, Mailchimp, Cloudflare Email) without touching business logic. Standard Schema means no hard Zod dependency either.
- **Batteries included** — middleware (rate-limit, idempotency, tracing, dry-run), hooks, plugins, and a logger built into core.

## Quick start

```sh
npm install @betternotify/core @betternotify/email zod
```

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel, mockTransport } from '@betternotify/email';
import { z } from 'zod';

const email = emailChannel({ defaults: { from: 'hello@example.com' } });
const rpc = createNotify({ channels: { email } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}`)
    .template({ render: async ({ input }) => ({ html: `<h1>Hi ${input.name}</h1>` }) }),
});

const mail = createClient({
  catalog,
  transportsByChannel: { email: mockTransport() },
});

await mail.welcome.send({ to: 'john@example.com', input: { name: 'John' } });
```

## Packages

| Channel                                                                          | Transport                                                                                        | Template                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`@betternotify/email`](https://www.npmjs.com/package/@betternotify/email)       | [`@betternotify/smtp`](https://www.npmjs.com/package/@betternotify/smtp)                         | [`@betternotify/react-email`](https://www.npmjs.com/package/@betternotify/react-email) |
| [`@betternotify/sms`](https://www.npmjs.com/package/@betternotify/sms)           | [`@betternotify/resend`](https://www.npmjs.com/package/@betternotify/resend)                     | [`@betternotify/mjml`](https://www.npmjs.com/package/@betternotify/mjml)               |
| [`@betternotify/push`](https://www.npmjs.com/package/@betternotify/push)         | [`@betternotify/mailchimp`](https://www.npmjs.com/package/@betternotify/mailchimp)               | [`@betternotify/handlebars`](https://www.npmjs.com/package/@betternotify/handlebars)   |
| [`@betternotify/webpush`](https://www.npmjs.com/package/@betternotify/webpush)   | [`@betternotify/cloudflare-email`](https://www.npmjs.com/package/@betternotify/cloudflare-email) |                                                                                        |
| [`@betternotify/slack`](https://www.npmjs.com/package/@betternotify/slack)       | [`@betternotify/twilio`](https://www.npmjs.com/package/@betternotify/twilio)                     |                                                                                        |
| [`@betternotify/discord`](https://www.npmjs.com/package/@betternotify/discord)   | [`@betternotify/autosend`](https://www.npmjs.com/package/@betternotify/autosend)                 |                                                                                        |
| [`@betternotify/telegram`](https://www.npmjs.com/package/@betternotify/telegram) | [`@betternotify/onesignal`](https://www.npmjs.com/package/@betternotify/onesignal)               |                                                                                        |
| [`@betternotify/whatsapp`](https://www.npmjs.com/package/@betternotify/whatsapp) | [`@betternotify/selligent`](https://www.npmjs.com/package/@betternotify/selligent)               |                                                                                        |
| [`@betternotify/github`](https://www.npmjs.com/package/@betternotify/github)     |                                                                                                  |                                                                                        |
| [`@betternotify/zapier`](https://www.npmjs.com/package/@betternotify/zapier)     |                                                                                                  |                                                                                        |

Core: [`@betternotify/core`](https://www.npmjs.com/package/@betternotify/core) · Integrations: [`@betternotify/mcp`](https://www.npmjs.com/package/@betternotify/mcp)

Scaffolding: [`create-better-notify`](https://www.npmjs.com/package/create-better-notify)

```sh
npx create-better-notify@latest
```

---

## Star History

<a href="https://star-history.dera.page/#better-notify/better-notify&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=better-notify/better-notify&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=better-notify/better-notify&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=better-notify/better-notify&type=date&legend=top-left" />
 </picture>
</a>

---

<p align="center">
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

<p align="center">Created by <a href="https://github.com/thereis">Lucas Reis</a> · <a href="https://x.com/lucasreis">X</a></p>

<p align="center">MIT License</p>
