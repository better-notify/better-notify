# @emailrpc/core

End-to-end typed email contracts, client, transports, middleware, and observability primitives for [emailRpc](../../README.md).

## Install

```sh
pnpm add @emailrpc/core
```

## multiTransport

Composes multiple `Transport`s into a single composite. Returned object is itself a `Transport` — register it like any other.

```ts
import { createClient } from '@emailrpc/core';
import { multiTransport } from '@emailrpc/core/transports';
import { smtpTransport } from '@emailrpc/smtp';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    {
      transport: smtpTransport({
        /* primary */
      }),
    },
    {
      transport: smtpTransport({
        /* backup */
      }),
    },
  ],
});
```

### Strategies

Each strategy decides which inner transport to try **first** on every `send()`. On failure, every strategy walks forward through the rest (modulo `n`) before giving up.

| Strategy        | First pick on each send                                | Use when                                                                                                                      |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `'failover'`    | Always `transports[0]`                                 | You have a clear primary + backup ordering — try the cheap/preferred provider first, fall back to the others only on failure. |
| `'round-robin'` | Cycles `0, 1, 2, …, 0, 1, …` via an in-process counter | You want even load distribution across equivalent providers within one process.                                               |
| `'random'`      | Uniformly random index                                 | You want load spreading without per-process coordination — multiple workers distribute on average without sharing state.      |

> Weighted distribution is deferred to v0.3 — the union expands without a breaking change.

### Retry within a transport

By default each inner transport gets one attempt; on failure, multiTransport advances immediately. Set `maxAttemptsPerTransport` and (optionally) `backoff` to retry the same transport before advancing:

```ts
multiTransport({
  strategy: 'failover',
  transports: [
    /* ... */
  ],
  maxAttemptsPerTransport: 3,
  backoff: { initialMs: 200, factor: 2, maxMs: 2000 },
});
```

Delay between attempts on the _same_ transport: `min(maxMs, initialMs * factor^(attempt-1))`. Advancing between transports never sleeps.

### Custom retry classification

```ts
multiTransport({
  strategy: 'failover',
  transports: [
    /* ... */
  ],
  isRetriable: (err) =>
    (err as { code?: string }).code === 'ETIMEDOUT' ||
    ((err as { responseCode?: number }).responseCode ?? 0) >= 500,
});
```

`isRetriable` defaults to `() => true` (every error retriable). Returning `false` advances immediately to the next transport — it does not abort the whole send.

### Observability

multiTransport accepts an optional `logger?: LoggerLike` and emits, on its own bound child (`{ component: 'multi-transport', name }`):

| Level   | Message                | Payload                                      |
| ------- | ---------------------- | -------------------------------------------- |
| `debug` | `multi attempt ok`     | `{ transportName, attempt, strategy }`       |
| `warn`  | `multi attempt failed` | `{ err, transportName, attempt, retriable }` |
| `error` | `multi exhausted`      | `{ attempts, lastErr }`                      |
| `error` | `multi close failed`   | `{ err, transportName }`                     |

## Middleware

Attach via `rpc.use(...)` on the root builder, on a sub-builder, or on a single email definition. All middleware ship under the `@emailrpc/core/middlewares` subpath.

| Middleware             | Purpose                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `withDryRun()`         | Short-circuit every send with a synthetic `SendResult` (`messageId: 'dry-run'`). Render and transport never run.                              |
| `withTagInject(opts)`  | Inject a static tag map into ctx as `tagsToInject` for downstream consumers. Header wiring lands with future args-mutation work.              |
| `withSuppressionList`  | Block sends to recipients present in a `SuppressionList`. Short-circuits with `messageId: 'suppressed'`.                                      |
| `withRateLimit`        | Throttle sends per derived `key` against a `RateLimitStore`. Throws `EmailRpcRateLimitedError` carrying `key` + `retryAfterMs` when exceeded. |
| `withIdempotency`      | Cache the first `SendResult` per `key` for `ttl` ms; replay on subsequent sends. Failures are not cached.                                     |
| `withEventLogger`      | Emit one structured `EmailEvent` per send into an `EventSink` (success or error).                                                             |
| `withTracing`          | Wrap each send in a `tracer.startActiveSpan(...)`. `TracerLike` is structurally compatible with `@opentelemetry/api`.                         |

### Quick examples

```ts
import {
  createEmailRpc,
  withRateLimit,
  withSuppressionList,
  withIdempotency,
  withEventLogger,
  withTracing,
  inMemoryRateLimitStore,
  inMemorySuppressionList,
  inMemoryIdempotencyStore,
  consoleEventSink,
} from '@emailrpc/core';

const rpc = createEmailRpc()
  .use(withSuppressionList({ list: inMemorySuppressionList() }))
  .use(withRateLimit({
    store: inMemoryRateLimitStore(),
    key: ({ args }) => Array.isArray(args.to) ? 'multi' : String(args.to),
    max: 3,
    window: 60_000,
  }))
  .use(withEventLogger({ sink: consoleEventSink() }));
```

## Stores

Pluggable storage contracts under `@emailrpc/core/stores`. Each contract is a plain `type` — implement it with any backend (Redis, DynamoDB, Postgres). Built-in in-memory adapters ship for dev and tests.

| Contract           | Methods                                  | Built-in                       | Factory                     |
| ------------------ | ---------------------------------------- | ------------------------------ | --------------------------- |
| `SuppressionList`  | `get(email)` · `set(email, entry)` · `del(email)` | `inMemorySuppressionList()`    | `createSuppressionList(...)` |
| `RateLimitStore`   | `record(key, windowMs, algorithm)`       | `inMemoryRateLimitStore()`     | —                           |
| `IdempotencyStore` | `get(key)` · `set(key, result, ttlMs)`   | `inMemoryIdempotencyStore()`   | `createIdempotencyStore(...)` |

`createSuppressionList` normalizes emails (trim + lowercase) before forwarding to your storage, so your backend doesn't need to. `createIdempotencyStore` is a typed pass-through. Both are useful when adapting Redis or other KVs.

```ts
import { createSuppressionList } from '@emailrpc/core';

const redisList = createSuppressionList({
  get: async (email) => {
    const json = await redis.get(`suppression:${email}`);
    return json ? JSON.parse(json) : null;
  },
  set: async (email, entry) => {
    await redis.set(`suppression:${email}`, JSON.stringify(entry));
  },
  del: async (email) => {
    await redis.del(`suppression:${email}`);
  },
});
```

`RateLimitStore.record` is a single round-trip "record an attempt and report state" — the middleware decides whether to block based on the returned `count`. Keeps the Redis path to one or two ops per send.

## Sinks

Write-only event destinations under `@emailrpc/core/sinks`. The dual of stores: where structured `EmailEvent`s go.

| Sink                                  | Purpose                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `inMemoryEventSink()`                 | Collects events into a readable array. For tests and local debugging.              |
| `consoleEventSink({ logger? })`       | Emits each event through a `LoggerLike` (defaults to `consoleLogger`).             |
| `createEventSink(opts)`               | Factory: BYO `write`. Adds failure isolation + optional `filter`.                  |

`createEventSink` wraps a user-supplied `write(event)` with two universal pieces:
- **Failure isolation.** Sink errors are caught — a flaky audit pipeline can't break email delivery. Default behavior logs the error via `errorLogger`; pass `onError` to take full control.
- **Optional `filter`.** Drop events you don't want shipped (e.g. errors-only).

```ts
const datadogSink = createEventSink({
  write: async (event) => {
    await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
      method: 'POST',
      headers: { 'DD-API-KEY': process.env.DD_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ddsource: 'emailrpc', service: 'mail', ...event }),
    });
  },
  filter: (event) => event.status === 'error',
});
```

## Tracers

Span-style tracing primitives under `@emailrpc/core/tracers`. The `TracerLike` interface is structurally compatible with `@opentelemetry/api`'s `Tracer.startActiveSpan(name, fn)` — pass an OTel tracer directly, no adapter:

```ts
import { trace } from '@opentelemetry/api';
import { withTracing } from '@emailrpc/core';

rpc.use(withTracing({ tracer: trace.getTracer('emailrpc') }));
```

For unit tests use `inMemoryTracer()` — records each span (name, attributes, status, exceptions) for assertion. Each `withTracing`-wrapped send sets `emailrpc.route` and `emailrpc.message_id` attributes; on failure, the exception is recorded and the status set to `error`.

## Errors

| Error                          | Code            | Surface                                                                         |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------- |
| `EmailRpcError`                | `'UNKNOWN'` …   | Base class. JSON-serializable for queue persistence.                            |
| `EmailRpcValidationError`      | `'VALIDATION'`  | Schema validation failure. Carries Standard Schema `issues`.                    |
| `EmailRpcRateLimitedError`     | `'RATE_LIMITED'`| Thrown by `withRateLimit`. Carries `key` and `retryAfterMs` for retry layers.   |
| `EmailRpcNotImplementedError`  | `'NOT_IMPLEMENTED'`| Thrown by deferred features.                                                 |
