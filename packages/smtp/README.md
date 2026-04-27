# @emailrpc/smtp

Nodemailer-backed SMTP transport for [emailRpc](../core).

## Install

```sh
pnpm add @emailrpc/smtp @emailrpc/core
```

## Usage

```ts
import { createNotify, createClient } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { smtpTransport } from '@emailrpc/smtp';

const email = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});
const rpc = createNotify({ channels: { email } });
const catalog = rpc.catalog({ /* routes */ });

const mail = createClient({
  catalog,
  channels: { email },
  transportsByChannel: {
    email: smtpTransport({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    }),
  },
});
```

## Options

| Field            | Type                                      | Description                                                                                                 |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `host`           | `string`                                  | SMTP server hostname. Required.                                                                             |
| `port`           | `number`                                  | SMTP port (typically 587 for STARTTLS or 465 for implicit TLS). Required.                                   |
| `secure`         | `boolean`                                 | Use implicit TLS from the start. Set `true` for port 465. Defaults to `false` (STARTTLS upgrade for 587).   |
| `auth`           | `{ user, pass }`                          | SMTP credentials.                                                                                           |
| `pool`           | `boolean`                                 | Reuse connections via a pool. Recommended for high throughput.                                              |
| `maxConnections` | `number`                                  | Pool ceiling when `pool: true`.                                                                             |
| `maxMessages`    | `number`                                  | Messages per connection before recycling, when `pool: true`.                                                |
| `dkim`           | `{ domainName, keySelector, privateKey }` | Sign outgoing messages with DKIM.                                                                           |
| `logger`         | `LoggerLike`                              | Override the warning logger (used for the auth-mismatch warning, see below). Defaults to `consoleLogger()`. |
| `nodemailer`     | `SMTPTransport.Options`                   | Escape hatch passed through to `nodemailer.createTransport`.                                                |

## ⚠️ Know your provider's sending limits

**Before deploying to production, read your SMTP provider's sending-limit documentation end-to-end.** Hitting an undocumented cap is the single most common way to disrupt a transactional email pipeline. Failure modes vary:

- Soft throttle: 4xx temporary rejection, your queue backs up
- Hard throttle: 5xx permanent rejection, messages drop unless you retry elsewhere
- Account suspension: provider locks the account, no sends until human review
- IP / domain reputation hit: future sends start landing in spam even after the limit resets

Limits typically apply across several axes — per second, per minute, per day, per recipient, per concurrent connection, per pool. Some are tier-dependent (e.g. AWS SES starts in a sandbox at 200/day with whitelisted recipients only; transactional providers often gate volume by paid plan).

This package will not protect you from limits — it's a thin transport. Rate limiting, retry budgets, and provider failover are application concerns; use middleware (`withRateLimit`) and `multiTransport({ strategy: 'failover' })` when needed.

## From-address rewriting

Some SMTP providers **rewrite** the `From` address of every outbound message to match the authenticated user (`auth.user`). The display name is preserved, the address is replaced. This is common with consumer-mail SMTP and a few transactional providers; check your provider's docs.

This transport emits a one-time `warn` log per unique mismatching `From` address:

```
WARN (smtp): From address differs from SMTP auth user; many providers will rewrite this
  fromAddress: noreply@example.com
  authUser: app@example.com
```

If you see this and want the original address to stick, switch to a provider that doesn't rewrite (your own MTA, or transactional providers that accept any verified domain) or align `defaults.from` with the authenticated address:

```ts
defaults: { from: { name: 'My App', email: process.env.SMTP_USER! } }
```

## Tests & development

```sh
pnpm --filter @emailrpc/smtp test
pnpm --filter @emailrpc/smtp build
```

Tests use a mocked nodemailer — no real SMTP server needed. To exercise against a local catcher, point at [Mailpit](https://github.com/axllent/mailpit) or [maildev](https://github.com/maildev/maildev).
