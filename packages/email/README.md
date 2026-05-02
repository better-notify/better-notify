# @betternotify/email

Email channel for [Better-Notify](../../README.md). Provides `emailChannel()`, a `mockTransport` for tests, address helpers, and `multiTransport` / `createTransport` factories pre-parameterized for `RenderedMessage`.

## Install

```sh
pnpm add @betternotify/email @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel, mockTransport } from '@betternotify/email';
import { z } from 'zod';

const email = emailChannel({
  defaults: { from: { name: 'Acme', email: 'hello@acme.com' } },
});
const rpc = createNotify({ channels: { email } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}`)
    .template({
      render: async ({ input }) => ({
        html: `<p>Hi ${input.name}, <a href="${input.verifyUrl}">verify</a>.</p>`,
        text: `Hi ${input.name}, verify: ${input.verifyUrl}`,
      }),
    }),
});

const mail = createClient({
  catalog,
  channels: { email },
  transportsByChannel: { email: mockTransport() },
});

await mail.welcome.send({
  to: 'user@example.com',
  input: { name: 'John', verifyUrl: 'https://acme.com/verify?t=abc' },
});
```

## Builder slots

The email channel is built on `defineChannel` and exposes these slots:

| Slot       | Required | Type                                                 | Description                                       |
| ---------- | -------- | ---------------------------------------------------- | ------------------------------------------------- |
| `subject`  | yes      | `string \| ({input}) => string`                      | Resolved per-send                                 |
| `template` | yes      | `TemplateAdapter \| ({input,ctx}) => RenderedOutput` | Renders `{ html, text?, subject? }`               |
| `from`     | no       | `string \| { name?, email }`                         | Per-route override of `defaults.from`             |
| `replyTo`  | no       | `Address`                                            | Per-route override of `defaults.replyTo`          |
| `tags`     | no       | `Tags`                                               | Surfaces in `RenderedMessage.tags` for transports |
| `priority` | no       | `'low' \| 'normal' \| 'high'`                        | Hint to provider                                  |

Plus `.input(schema)` (any Standard Schema) and `.use(mw)` (middleware) on every builder.

## Send args

```ts
mail.welcome.send({
  to: Address | Address[],
  cc?: Address | Address[],
  bcc?: Address | Address[],
  replyTo?: Address,
  from?: FromInput,
  headers?: Record<string, string>,
  attachments?: Attachment[],
  input: TInput, // typed from .input(schema)
});
```

Where `Address = string | { name?, email }`.

## Transports

```ts
import {
  mockTransport,
  multiTransport,
  createTransport,
  formatAddress,
  normalizeAddress,
} from '@betternotify/email/transports';
```

- `mockTransport()` — records sent messages for tests; returns `{ ok: true, data: { accepted, rejected } }`.
- `multiTransport({ strategy, transports, ... })` — failover/round-robin/random across multiple email transports.
- `createTransport({ name, send, verify?, close? })` — wrap a custom email send function as a `Transport<RenderedMessage, EmailTransportData>`.
- `formatAddress(addr)` / `normalizeAddress(addr)` — convert `Address` to wire format (`"Name <email>"` or `email`).

Provider transports for the email channel:

- [`@betternotify/smtp`](../smtp) — SMTP via nodemailer
- [`@betternotify/ses`](../ses) — AWS SES (stub)
- [`@betternotify/resend`](../resend) — Resend (stub)

## Custom render output

`.template(fn)` is shorthand for `.template({ render: fn })`. The function form receives `{ input, ctx }` and returns `{ html, text?, subject? }` (or a Promise of one).

## License

MIT
