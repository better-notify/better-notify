# Better-Notify

End-to-end typed notification infrastructure for Node.js. Define a multi-channel `Catalog` once, get a typed client (`mail.<route>.send(...)` / `.batch(...)`) that dispatches to email, SMS, push, or any custom channel — all sharing the same validation, middleware, hooks, and transport contracts.

> **Status:** v0.0.3-alpha. Multi-channel pipeline (email + SMS + push) is real, with generic `Channel<>` and `Transport<TRendered, TData>` contracts in `@betternotify/core` and a `defineChannel` factory for custom channels. Queue/worker and webhook router for non-email channels land later.

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
    text: runtime.text,
  }),
});
```

`slot.resolver<T>()` accepts `T | (({input}) => T)`. `slot.value<T>()` accepts only `T`. Both support `.optional()`. See `examples/welcome-text/apps/cli/src/examples/custom-channel.ts` for the full Slack channel + transport.

## Custom transports

```ts
import { createTransport, multiTransport, createMockTransport } from '@betternotify/core/transports';

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

## Error handling

Every error thrown by Better-Notify is a `NotifyRpcError` (or one of its subclasses). Catch the base
class to handle all framework errors, or a subclass to handle a specific case:

```ts
import {
  NotifyRpcError,
  NotifyRpcValidationError,
  NotifyRpcRateLimitedError,
} from '@betternotify/core';

try {
  await mail.welcome.send({ to, input });
} catch (err) {
  if (err instanceof NotifyRpcValidationError) {
    // Input failed the .input() schema — inspect err.issues for details.
    console.error(err.issues);
  } else if (err instanceof NotifyRpcRateLimitedError) {
    // withRateLimit middleware blocked this send.
    // err.retryAfterMs tells you exactly how long to wait.
    setTimeout(() => retry(), err.retryAfterMs);
  } else if (err instanceof NotifyRpcError) {
    // All other framework errors — check err.code for the category.
    console.error(err.code, err.route, err.messageId);
  }
}
```

### Error codes

| Code                    | When thrown                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `VALIDATION`            | Input fails the `.input()` schema                                             |
| `PROVIDER`              | Transport throws or returns `{ ok: false }`                                   |
| `CONFIG`                | No channel or transport registered for the route's channel                    |
| `RENDER`                | Template adapter throws during `render()`                                     |
| `RATE_LIMITED`          | `withRateLimit` middleware exceeds its threshold                              |
| `NOT_IMPLEMENTED`       | Feature is declared but not yet shipped                                       |
| `CHANNEL_NOT_QUEUEABLE` | `.queue()` called on a channel without a queue adapter                        |
| `BATCH_EMPTY`           | `.batch()` called with an empty array                                         |
| `UNKNOWN`               | A middleware or hook threw a non-`NotifyRpcError`; re-wrapped at the boundary |

All errors are JSON-serializable via `.toJSON()` for queue persistence and structured logging.

### `onError` hook and error phases

The `onError` hook fires on every error regardless of where it originates. The `phase` field
identifies the pipeline stage:

| Phase        | When it fires                                                        |
| ------------ | -------------------------------------------------------------------- |
| `validate`   | Input schema check fails                                             |
| `middleware` | A middleware throws outside the render/send core                     |
| `render`     | Template adapter throws                                              |
| `send`       | Transport throws or returns `{ ok: false }`                          |
| `hook`       | A lifecycle hook (`onBeforeSend`, `onExecute`, `onAfterSend`) throws |

```ts
const mail = createClient({
  catalog,
  channels,
  transportsByChannel,
  hooks: {
    onError: ({ error, phase, route, messageId }) => {
      logger.error({ err: error, phase, route, messageId });
    },
  },
});
```

## Middleware

Middleware wraps the send pipeline. It runs **around** the render+send core: code before `next()`
runs before the send; code after `next()` runs after.

```ts
const logTiming =
  (): Middleware =>
  async ({ route, next }) => {
    const t = performance.now();
    const result = await next();
    console.log(route, performance.now() - t, 'ms');
    return result;
  };
```

### Execution order

Middleware is composed in a **first-added wraps outermost** order:

1. **Plugin middleware** — added via `createClient({ plugins: [{ middleware: [...] }] })`
2. **Route middleware** — added via `.use(mw)` on the builder

Within each group, earlier entries wrap outer. The execution flow for a single send:

```text
validate input
  → onBeforeSend hooks
  → plugin[0].before → plugin[1].before → route[0].before → route[1].before
    → render
    → onExecute hooks
    → transport.send
← route[1].after ← route[0].after ← plugin[1].after ← plugin[0].after
  → onAfterSend hooks
```

### Built-in middleware

| Factory                 | Purpose                                                | Throws                      |
| ----------------------- | ------------------------------------------------------ | --------------------------- |
| `withDryRun()`          | Short-circuits every send with a synthetic result      | —                           |
| `withTagInject(opts)`   | Injects a static `tags` map into `ctx`                 | —                           |
| `withEventLogger(opts)` | Emits one `SendEvent` per send to an `EventSink`       | —                           |
| `withRateLimit(opts)`   | Throttles sends by key; fixed or sliding window        | `NotifyRpcRateLimitedError` |
| `withIdempotency(opts)` | Replays cached result for duplicate keys (best-effort) | —                           |
| `withTracing(opts)`     | Wraps each send in an OpenTelemetry-compatible span    | —                           |

Middleware is attached at route level via `.use()` or at the client level via `plugins`:

```ts
// Route level
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(schema)
    .use(
      withRateLimit({
        store: inMemoryRateLimitStore(),
        key: ({ args }) => String(args.to),
        max: 3,
        window: 60_000,
      }),
    )
    .use(withEventLogger({ sink: consoleEventSink() }))
    .subject('Welcome')
    .template(adapter),
});

// Plugin level (applies to all routes)
const mail = createClient({
  catalog,
  channels,
  transportsByChannel,
  plugins: [{ middleware: [withTracing({ tracer })] }],
});
```

**Rule of thumb:** if removing the middleware would change whether an email goes out, it must be
middleware. If it only observes, use a hook instead.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm test:coverage
```

Releases are managed by release-please via conventional commits — no manual changeset step needed.

Requires Node ≥ 22 and pnpm 10.

## License

MIT
