# emailRpc

End-to-end typed email infrastructure for Node.js. Define email contracts once, get a typed sender, queue worker, and webhook router — all driven by the same `EmailCatalog` type.

> **Status:** v0.1.0-alpha. This bootstrap ships Layer 1 (typed contracts) in `@emailrpc/core` plus build/release tooling. Senders, providers, queues, and webhook handlers are stubbed and land in v0.2+. Packages are ESM-only at this stage; CJS output will return alongside the v1.0 stable release once the public API is frozen.

## Packages

| Package                 | Status | Purpose                                                                            |
| ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| `@emailrpc/core`        | alpha  | Contracts, builder, catalog, template adapter interface, Standard Schema validation |
| `@emailrpc/react-email` | stub   | React Email adapter                                                                |
| `@emailrpc/mjml`        | stub   | MJML adapter                                                                       |
| `@emailrpc/handlebars`  | stub   | Handlebars adapter                                                                 |
| `@emailrpc/ses`         | stub   | AWS SES provider                                                                   |
| `@emailrpc/resend`      | stub   | Resend provider                                                                    |
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
