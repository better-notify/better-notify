# emailRpc

End-to-end typed email infrastructure for Node.js. Define email contracts once, get a typed sender, queue worker, and webhook router — all driven by the same `EmailCatalog` type.

> **Status:** v0.1.0-alpha. Layer 1 (typed contracts) and the send pipeline (validation, render, middleware/hooks/plugins, transports including SMTP and `multiTransport` failover) are real in `@emailrpc/core` and `@emailrpc/smtp`. Workers, webhooks, and the remaining provider/template adapters land in v0.2+. Packages are ESM-only at this stage; CJS output will return alongside the v1.0 stable release once the public API is frozen.

## Quick start

```ts
import { createEmailRpc, createClient } from '@emailrpc/core';
import { smtpTransport } from '@emailrpc/smtp';
import { z } from 'zod';

const rpc = createEmailRpc();

const welcome = rpc.email()
  .input(z.object({ name: z.string() }))
  .subject(({ input }) => `Welcome, ${input.name}`)
  .template({ render: async ({ input }) => ({ html: `<p>Hi ${input.name}</p>` }) })
  .from('hello@example.com');

const catalog = rpc.catalog({ welcome });

const mail = createClient({
  catalog,
  transports: [{ name: 'smtp', transport: smtpTransport({ url: process.env.SMTP_URL! }), priority: 1 }],
});

await mail.welcome.send({ to: 'john@example.com', input: { name: 'John Doe' } });
```

Sub-catalogs compose into a single typed surface and flatten into dot-path IDs:

```ts
const transactional = rpc.catalog({ welcome, passwordReset });
const marketing = rpc.catalog({ newsletter });
const root = rpc.catalog({ transactional, marketing });

const mail = createClient({ catalog: root, transports: [...] });
await mail.transactional.welcome.send({ to, input });   // logs route: "transactional.welcome"
```

## Packages

| Package                 | Status | Purpose                                                                            |
| ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| `@emailrpc/core`        | alpha  | Contracts, builder, catalog, client, transports (`mockTransport`, `multiTransport`), middleware/hooks/plugins, Standard Schema validation, structural logger |
| `@emailrpc/smtp`        | alpha  | SMTP transport (nodemailer-based)                                                  |
| `@emailrpc/react-email` | stub   | React Email template adapter                                                       |
| `@emailrpc/mjml`        | stub   | MJML template adapter                                                              |
| `@emailrpc/handlebars`  | stub   | Handlebars template adapter                                                        |
| `@emailrpc/ses`         | stub   | AWS SES transport                                                                  |
| `@emailrpc/resend`      | stub   | Resend transport                                                                   |
| `@emailrpc/bullmq`      | stub   | BullMQ queue adapter                                                               |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Add a changeset for any user-facing change:

```sh
pnpm changeset
```

Requires Node ≥ 22 and pnpm 10.

## License

MIT
