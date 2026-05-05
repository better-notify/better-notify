---
name: better-notify/best-practices
description: Quick reference for Better Notify configuration, patterns, and common gotchas
---

# Better Notify Quick Reference

**Always consult [better-notify.com/docs](https://better-notify.com/docs) for latest API.**

---

## Setup Workflow

1. Install: `npm install @betternotify/core @betternotify/email` (+ channel/transport packages)
2. Define channels and catalog in `lib/notify.ts`
3. Create client with transports in `lib/notify-client.ts`
4. Send: `mail.<route>.send({ to, input })`

---

## Core API

| Function                                                   | Import               | Purpose                                         |
| ---------------------------------------------------------- | -------------------- | ----------------------------------------------- |
| `createNotify({ channels })`                               | `@betternotify/core` | Root builder with channel map                   |
| `createClient({ catalog, channels, transportsByChannel })` | `@betternotify/core` | Type-safe send client                           |
| `createCatalog(map)`                                       | `@betternotify/core` | Standalone catalog (without builder)            |
| `defineChannel({ name, slots, validateArgs, render })`     | `@betternotify/core` | Custom channel definition                       |
| `slot.resolver<T>()` / `slot.value<T>()`                   | `@betternotify/core` | Template slot declarations                      |
| `consoleLogger({ level })`                                 | `@betternotify/core` | Built-in console logger                         |
| `handlePromise(promise)`                                   | `@betternotify/core` | Tuple-returning async wrapper `[error, result]` |

---

## Channel Slots

Each channel has typed slots set via the builder:

### Email (`@betternotify/email`)

| Slot                 | Type                                          | Required |
| -------------------- | --------------------------------------------- | -------- |
| `.input(schema)`     | Standard Schema (Zod, Valibot, ArkType)       | Yes      |
| `.subject(resolver)` | `string` or `(args) => string`                | Yes      |
| `.template(adapter)` | `TemplateAdapter` or `{ render }`             | Yes      |
| `.from(resolver)`    | `Address` or `(args) => Address`              | No       |
| `.replyTo(address)`  | `Address`                                     | No       |
| `.tags(tags)`        | `Record<string, string \| number \| boolean>` | No       |
| `.priority(level)`   | `'low' \| 'normal' \| 'high'`                 | No       |

**Send args:** `{ to, input, cc?, bcc?, replyTo?, from?, headers?, attachments? }`

### SMS (`@betternotify/sms`)

| Slot              | Type                           | Required |
| ----------------- | ------------------------------ | -------- |
| `.input(schema)`  | Standard Schema                | Yes      |
| `.body(resolver)` | `string` or `(args) => string` | Yes      |

**Send args:** `{ to: string, input }` (phone number)

### Push (`@betternotify/push`)

| Slot               | Type                           | Required |
| ------------------ | ------------------------------ | -------- |
| `.input(schema)`   | Standard Schema                | Yes      |
| `.title(resolver)` | `string` or `(args) => string` | Yes      |
| `.body(resolver)`  | `string` or `(args) => string` | Yes      |
| `.data(resolver)`  | `Record<string, unknown>`      | No       |
| `.badge(resolver)` | `number`                       | No       |

**Send args:** `{ to: string \| string[], input }` (device tokens)

### Slack (`@betternotify/slack`)

| Slot                | Type                           | Required |
| ------------------- | ------------------------------ | -------- |
| `.input(schema)`    | Standard Schema                | Yes      |
| `.text(resolver)`   | `string` or `(args) => string` | Yes      |
| `.blocks(resolver)` | `SlackBlock[]`                 | No       |

**Send args:** `{ input, to?: string, threadTs?: string }` (channel ID)

### Discord (`@betternotify/discord`)

| Slot                | Type                           | Required |
| ------------------- | ------------------------------ | -------- |
| `.input(schema)`    | Standard Schema                | Yes      |
| `.body(resolver)`   | `string` or `(args) => string` | Yes      |
| `.embeds(resolver)` | `DiscordEmbed[]`               | No       |
| `.username(value)`  | `string`                       | No       |
| `.avatarUrl(value)` | `string`                       | No       |

**Send args:** `{ input }`

### Telegram (`@betternotify/telegram`)

| Slot                    | Type                                   | Required |
| ----------------------- | -------------------------------------- | -------- |
| `.input(schema)`        | Standard Schema                        | Yes      |
| `.body(resolver)`       | `string` or `(args) => string`         | Yes      |
| `.parseMode(mode)`      | `'HTML' \| 'Markdown' \| 'MarkdownV2'` | No       |
| `.attachment(resolver)` | `TelegramAttachment`                   | No       |

**Send args:** `{ to: string \| number, input }` (chat ID)

---

## Subpath Imports

Import optional features from subpaths, **not** the root barrel:

```typescript
// Correct
import { withRateLimit } from '@betternotify/core/middlewares';
import { inMemoryRateLimitStore } from '@betternotify/core/stores';
import { consoleEventSink } from '@betternotify/core/sinks';
import { inMemoryTracer } from '@betternotify/core/tracers';

// Wrong — do not import these from '@betternotify/core'
```

| Subpath        | Exports                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/middlewares` | `withDryRun`, `withTagInject`, `withEventLogger`, `withRateLimit`, `withIdempotency`, `withTracing`, `createMiddleware`                                    |
| `/stores`      | `inMemorySuppressionList`, `inMemoryRateLimitStore`, `inMemoryIdempotencyStore`, `createSuppressionList`, `createRateLimitStore`, `createIdempotencyStore` |
| `/sinks`       | `inMemoryEventSink`, `consoleEventSink`, `createEventSink`                                                                                                 |
| `/tracers`     | `inMemoryTracer`                                                                                                                                           |
| `/transports`  | `createHttpClient`, `createTransport`, `multiTransport`, `mapTransport`                                                                                    |
| `/logger`      | `consoleLogger`, `fromPino`                                                                                                                                |
| `/plugins`     | `createPlugin`                                                                                                                                             |

---

## Middleware

Middleware mutates context or short-circuits the pipeline. Named with `with` prefix.

```typescript
const rpc = createNotify({ channels: { email: ch } })
  .use(withRateLimit({ store, key, max, window }))
  .use(withIdempotency({ store, key, ttl }))
  .use(withDryRun());
```

**Custom middleware:**

```typescript
import { createMiddleware } from '@betternotify/core/middlewares';

const withLogging = createMiddleware(async ({ next, route, messageId }) => {
  console.log(`Sending ${route} (${messageId})`);
  return next();
});
```

---

## Hooks

Hooks observe but don't mutate. Set on `createClient`:

```typescript
const mail = createClient({
  catalog,
  channels: { email: ch },
  transportsByChannel: { email: transport },
  hooks: {
    onBeforeSend: ({ route, messageId, args }) => { ... },
    onExecute: ({ rendered }) => { ... },
    onAfterSend: ({ result, timing }) => { ... },
    onError: ({ error, phase }) => { ... },
  },
})
```

**Error phases:** `'validate' | 'middleware' | 'render' | 'send' | 'hook'`

**Rule:** If removing it would change whether the notification goes out, it must be middleware, not a hook.

---

## Client API

```typescript
// Single send
const result = await mail.welcome.send({ to, input })
// result: { messageId, data, envelope?, timing: { renderMs, sendMs } }

// Batch send
const batch = await mail.welcome.batch([{ to, input }, ...], { interval: 250 })
// batch: { okCount, errorCount, results: [{ status, result?, error? }] }

// Render only (no send)
const rendered = await mail.welcome.render(input)

// Cleanup
await mail.close()
```

---

## Address Types (Email)

```typescript
// String shorthand
{ to: 'user@example.com' }

// Object with name
{ to: { name: 'Alice', email: 'alice@example.com' } }

// Multiple recipients
{ to: ['alice@example.com', { name: 'Bob', email: 'bob@example.com' }] }

// From — both fields optional (merges with defaults)
{ from: { name: 'Support' } }         // uses default email
{ from: { email: 'no-reply@...' } }   // uses default name
```

---

## Error Classes

All errors subclass `NotifyRpcError` and are JSON-serializable.

| Error                          | When                                     |
| ------------------------------ | ---------------------------------------- |
| `NotifyRpcValidationError`     | Input fails schema validation            |
| `NotifyRpcRateLimitedError`    | Rate limit exceeded (has `retryAfterMs`) |
| `NotifyRpcNotImplementedError` | Feature not yet available                |
| `NotifyRpcProviderError`       | Transport delivery failure               |

---

## Multi-Transport Strategies

```typescript
import { multiTransport } from '@betternotify/email';

multiTransport({
  strategy: 'failover', // try next on failure
  transports: [{ transport: primary }, { transport: fallback }],
});
```

| Strategy      | Behavior                                   |
| ------------- | ------------------------------------------ |
| `failover`    | Try transports in order until one succeeds |
| `round-robin` | Rotate between transports                  |
| `random`      | Pick randomly                              |
| `race`        | Send via all, return first success         |
| `parallel`    | Send via all, wait for all                 |
| `mirrored`    | Send via all, return primary result        |

---

## Common Gotchas

1. **Import from subpaths** — `@betternotify/core/middlewares`, not `@betternotify/core`. Root barrel only exports core primitives.
2. **Standard Schema, not just Zod** — `.input()` accepts Zod, Valibot, or ArkType schemas. Don't assume Zod.
3. **Resolvers can be static or functions** — `.subject('Hello')` and `.subject(({ input }) => input.title)` are both valid.
4. **`from` merges per-field** — Per-email `from` and `defaults.from` shallow-merge. `{ from: { name: 'Support' } }` keeps the default email.
5. **Transport is dumb** — Transports receive fully-resolved messages. No validation, no rendering. That happens upstream in the pipeline.
6. **Middleware vs hooks** — If removing it changes whether the notification sends, it's middleware. Hooks only observe.
7. **Mock transports for testing** — Each channel package exports a mock: `mockTransport()` (email), `mockSmsTransport()` (SMS), etc. Check `.sent` or `.messages` array.
8. **Sub-catalogs flatten** — `{ transactional: rpc.catalog({ welcome: ... }) }` creates route `transactional.welcome`, accessed as `mail.transactional.welcome.send()`.
9. **ESM only** — Better Notify is ESM-only, requires Node >= 22.
10. **`handlePromise` over try/catch** — Use `const [err, result] = await handlePromise(promise)` for async error handling.

---

## Resources

- [Docs](https://better-notify.com/docs)
- [GitHub](https://github.com/better-notify/better-notify)
- [Examples](https://github.com/better-notify/better-notify/tree/main/examples)
