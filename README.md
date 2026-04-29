# BetterNotify

End-to-end typed notification infrastructure for Node.js. Define a multi-channel `Catalog` once, get a typed client (`mail.<route>.send(...)` / `.batch(...)`) that dispatches to email, SMS, push, or any custom channel — all sharing the same validation, middleware, hooks, and transport contracts.

> **Status:** v0.0.1. Multi-channel pipeline (email + SMS + push) is real, with generic `Channel<>` and `Transport<TRendered, TData>` contracts in `@betternotify/core` and a `defineChannel` factory for custom channels. Queue/worker and webhook router for non-email channels land later.

## Quick start

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
    .template({ render: async ({ input }) => ({ html: `<p>Hi ${input.name}</p>` }) }),
});

const mail = createClient({
  catalog,
  channels: { email },
  transportsByChannel: { email: mockTransport() },
});

await mail.welcome.send({ to: 'john@example.com', input: { name: 'John Doe' } });
```

Sub-catalogs compose into a single typed surface and flatten into dot-path IDs:

```ts
const transactional = rpc.catalog({ welcome, passwordReset });
const marketing = rpc.catalog({ newsletter });
const root = rpc.catalog({ transactional, marketing });

const mail = createClient({
  catalog: root,
  channels: { email },
  transportsByChannel: { email: t },
});
await mail.transactional.welcome.send({ to, input }); // logs route: "transactional.welcome"
```

## Multiple channels

```ts
import { emailChannel } from '@betternotify/email';
import { smsChannel, mockSmsTransport } from '@betternotify/sms';
import { pushChannel, mockPushTransport } from '@betternotify/push';

const channels = { email: emailChannel(), sms: smsChannel(), push: pushChannel() };
const rpc = createNotify({ channels });

const catalog = rpc.catalog({
  welcomeEmail: rpc.email().input(/*...*/).subject('Welcome').template(/*...*/),
  welcomeSms: rpc
    .sms()
    .input(/*...*/)
    .body(({ input }) => `Hi ${input.name}`),
  welcomePush: rpc
    .push()
    .input(/*...*/)
    .title('Welcome')
    .body(({ input }) => `Hi ${input.name}`),
});

const notify = createClient({
  catalog,
  channels,
  transportsByChannel: {
    email: mockTransport(),
    sms: mockSmsTransport(),
    push: mockPushTransport(),
  },
});

await notify.welcomeSms.send({ to: '+15555555555', input: { name: 'Alice' } });
```

## Custom channels

```ts
import { defineChannel, slot } from '@betternotify/core';

const slackChannel = defineChannel({
  name: 'slack' as const,
  slots: { text: slot.resolver<string>() },
  validateArgs: z.object({ channel: z.string(), threadTs: z.string().optional() }),
  render: ({ runtime, args }) => ({
    channel: args.channel,
    text: typeof runtime.text === 'function' ? runtime.text({ input: args.input }) : runtime.text,
  }),
});
```

`slot.resolver<T>()` accepts `T | (({input}) => T)`. `slot.value<T>()` accepts only `T`. Both support `.optional()`. See `examples/welcome-text/apps/cli/src/examples/custom-channel.ts` for the full Slack channel + transport.

## Custom transports

```ts
import { createTransport, multiTransport, createMockTransport } from '@betternotify/core';

const myTransport = createTransport<MyRendered, MyData>({
  name: 'my-api',
  send: async (rendered, ctx) => {
    const res = await fetch('...', { body: JSON.stringify(rendered) });
    if (!res.ok) return { ok: false, error: new Error(await res.text()) };
    return { ok: true, data: { id: (await res.json()).id } };
  },
});
```

Each channel package re-exports these factories pre-parameterized for that channel's `TRendered` and `TData`, so users typically import `multiTransport` from `@betternotify/email` (or sms/push) and skip the generics.

## Packages

| Package                     | Purpose                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@betternotify/core`        | `Channel<>`, `Transport<>`, `defineChannel`, `createNotify`, `createClient`, `createCatalog`, middleware, hooks, plugins, stores, sinks, tracers, generic transport factories (`createTransport`, `multiTransport`, `createMockTransport`) |
| `@betternotify/email`       | `emailChannel()`, `mockTransport`, address helpers, `multiTransport`/`createTransport` parameterized for email                                                                                                                             |
| `@betternotify/sms`         | `smsChannel()`, `mockSmsTransport`, sms-typed `multiTransport`/`createTransport`                                                                                                                                                           |
| `@betternotify/push`        | `pushChannel()`, `mockPushTransport`, push-typed `multiTransport`/`createTransport`                                                                                                                                                        |
| `@betternotify/smtp`        | SMTP transport for the email channel (nodemailer-based)                                                                                                                                                                                    |
| `@betternotify/react-email` | React Email template adapter                                                                                                                                                                                                               |
| `@betternotify/mjml`        | MJML template adapter (stub)                                                                                                                                                                                                               |
| `@betternotify/handlebars`  | Handlebars template adapter (stub)                                                                                                                                                                                                         |
| `@betternotify/ses`         | AWS SES transport (stub)                                                                                                                                                                                                                   |
| `@betternotify/resend`      | Resend transport (stub)                                                                                                                                                                                                                    |
| `@betternotify/bullmq`      | BullMQ queue adapter (stub)                                                                                                                                                                                                                |

## Implementation status

✅ = ships and works today · 🚧 = package is published but throws `NotImplementedError` at runtime

### Packages

| Package                     | Status | Planned |
| --------------------------- | ------ | ------- |
| `@betternotify/core`        | ✅     | —       |
| `@betternotify/email`       | ✅     | —       |
| `@betternotify/sms`         | ✅     | —       |
| `@betternotify/push`        | ✅     | —       |
| `@betternotify/smtp`        | ✅     | —       |
| `@betternotify/react-email` | ✅     | —       |
| `@betternotify/ses`         | 🚧     | v0.3    |
| `@betternotify/resend`      | 🚧     | v0.3    |
| `@betternotify/bullmq`      | 🚧     | v0.3    |
| `@betternotify/mjml`        | 🚧     | v0.4    |
| `@betternotify/handlebars`  | 🚧     | v0.4    |

### Core APIs

| Feature                                                                                                          | Subpath export                   | Status | Planned |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------ | ------- |
| Channel contracts (`Channel<>`, `defineChannel`, `slot`)                                                         | `@betternotify/core`             | ✅     | —       |
| Catalog builder (`createNotify`, `createCatalog`)                                                                | `@betternotify/core`             | ✅     | —       |
| Typed client (`createClient`, `.send()`, `.batch()`)                                                             | `@betternotify/core`             | ✅     | —       |
| Middleware (`withDryRun`, `withRateLimit`, `withIdempotency`, `withEventLogger`, `withTagInject`, `withTracing`) | `@betternotify/core/middlewares` | ✅     | —       |
| Suppression-list middleware (`withSuppressionList`)                                                              | `@betternotify/email`            | ✅     | —       |
| Stores (idempotency, rate-limit, suppression)                                                                    | `@betternotify/core/stores`      | ✅     | —       |
| Event sinks (`inMemoryEventSink`, `consoleEventSink`)                                                            | `@betternotify/core/sinks`       | ✅     | —       |
| Tracing (`inMemoryTracer`)                                                                                       | `@betternotify/core/tracers`     | ✅     | —       |
| Logger (`consoleLogger`, `fromPino`)                                                                             | `@betternotify/core/logger`      | ✅     | —       |
| Config (`defineConfig`)                                                                                          | `@betternotify/core/config`      | ✅     | —       |
| Queue worker (`createWorker`)                                                                                    | `@betternotify/core/worker`      | 🚧     | v0.3    |
| Webhook router (`toNodeHandler`, `toFetchHandler`)                                                               | `@betternotify/core/webhook`     | 🚧     | v0.3    |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm test:coverage
```

Add a changeset for any user-facing change:

```sh
pnpm changeset
```

Requires Node ≥ 22 and pnpm 10.

## License

MIT
