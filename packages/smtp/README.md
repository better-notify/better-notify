# @betternotify/smtp

Nodemailer-backed SMTP transport for [Better-Notify](../core).

## Install

```sh
pnpm add @betternotify/smtp @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { smtpTransport } from '@betternotify/smtp';

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

## Attachments

Pass attachments through the `attachments` field on send args. Each entry needs `filename` and `content` (Buffer or string); `contentType` defaults to `application/octet-stream`. Use `cid` for inline images referenced via `<img src="cid:logo@inline">` in your HTML.

```ts
import { readFile } from 'node:fs/promises';

const logoPngBuffer = await readFile('./logo.png');

await mail.welcome.send({
  to: 'user@example.com',
  input: { name: 'Alice' },
  attachments: [
    {
      filename: 'invoice.pdf',
      content: await readFile('./invoice.pdf'),
      contentType: 'application/pdf',
    },
    {
      filename: 'logo.png',
      content: logoPngBuffer,
      contentType: 'image/png',
      cid: 'logo@inline',
    },
  ],
});
```

## UTF-8 and special characters

Nodemailer handles UTF-8 encoding for subjects, display names, and body content automatically. Non-ASCII characters (accented names, CJK, emoji) work without extra configuration in subjects, From/To display names, and HTML/text bodies.

## Known limitations

The SMTP transport maps `from`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `html`, `text`, `headers`, and `attachments` from `RenderedMessage`. The `inlineAssets`, `tags`, and `priority` fields are **not forwarded** to nodemailer — SMTP has no standard mechanism for metadata tags or priority hints beyond custom headers. If you need these, map them to `X-` headers via middleware before they reach the transport.

## Tests & development

```sh
pnpm --filter @betternotify/smtp test
pnpm --filter @betternotify/smtp build
```

Unit tests use a mocked nodemailer — no real SMTP server needed. To exercise against a local catcher, point at [Mailpit](https://github.com/axllent/mailpit) or [maildev](https://github.com/maildev/maildev).

### Integration tests (Ethereal)

The `integration.test.ts` suite sends real email through [Ethereal](https://ethereal.email/) (a free throwaway SMTP service from the nodemailer team). It's skipped by default and requires network access:

```sh
SMTP_INTEGRATION=1 pnpm --filter @betternotify/smtp test
```

The test prints an Ethereal preview URL so you can inspect the delivered message in a browser.

## Manual verification checklist

These scenarios need live credentials and cannot be fully automated:

- **Deliverability**: send to a real inbox (Gmail, Outlook) and confirm the message arrives in the primary tab, not spam.
- **DKIM signature**: configure `dkim` and verify the signature using a mail header analyzer (e.g. Google Admin Toolbox).
- **From-address rewriting**: send with a `from` different from `auth.user` and check whether the provider rewrites it. Observe the one-time warning in logs.
- **Large attachments**: send a message with a 10 MB+ attachment; confirm the provider doesn't silently truncate or reject.
- **Connection pool reconnect**: enable `pool: true`, send a message, wait 10+ minutes (beyond server idle timeout), then send another. Verify the pool recovers without error.
- **TLS modes**: test both `secure: false` (STARTTLS on 587) and `secure: true` (implicit TLS on 465) against your provider.
