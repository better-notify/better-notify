# @betternotify/core

Channel-agnostic notification infrastructure: contracts, client pipeline, transport factories, middleware, hooks, plugins, and observability primitives. See the [root README](../../README.md) for the high-level overview and quick-start.

## Install

```sh
pnpm add @betternotify/core
```

## What's in here

- **`createNotify({ channels })`** — root builder factory. Returns a typed `rpc` with `.use(mw)`, `.catalog(...)`, and one method per registered channel.
- **`createClient({ catalog, channels, transportsByChannel, ... })`** — typed client. `mail.<route>.send()`, `.batch()`, `.queue()`, `.render()`.
- **`createCatalog(map)`** — aggregates channel routes (and sub-catalogs) into one typed `Catalog<M, Ctx>`.
- **`Channel<TName, TBuilder, TArgs, TRendered, TTransport>`** — channel contract. Exposes `createBuilder`, `validateArgs`, `render`, optional `previewRender`, `finalize`.
- **`defineChannel({ name, slots, validateArgs, render })`** — factory that generates the entire `Channel<>` plus a chained slot-setter builder. See custom-channel example.
- **`Transport<TRendered, TData>`** — wire-level send adapter. Returns `TransportResult<TData> = { ok: true, data } | { ok: false, error }`.
- **`createTransport<TRendered, TData>(...)`** / **`multiTransport<TRendered, TData>(...)`** / **`createMockTransport<TRendered, TData>(...)`** — generic transport factories. Channel packages re-export these pre-parameterized.
- **`NotifyRpcError`** + subclasses — framework error class with `code`, `route`, `messageId`. JSON-serializable.
- **Middleware**: `withDryRun`, `withTagInject`, `withEventLogger`, `withSuppressionList`, `withRateLimit`, `withIdempotency`, `withTracing`.
- **Stores**: in-memory implementations for suppression / rate-limit / idempotency.
- **Sinks**: event sink contract + in-memory and console implementations.
- **Tracers**: in-memory tracer for `withTracing`.
- **Logger**: structural `LoggerLike` + `consoleLogger()` + `fromPino()` adapter.

## defineChannel

```ts
import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';

const slackChannel = defineChannel({
  name: 'slack' as const,
  slots: {
    text: slot.resolver<string>(),
    threadTs: slot.value<string>().optional(),
  },
  validateArgs: z.object({ channel: z.string() }),
  render: ({ runtime, args }) => ({
    channel: args.channel,
    text: typeof runtime.text === 'function' ? runtime.text({ input: args.input }) : runtime.text,
  }),
});
```

`slot.resolver<T>()` accepts `T | ((args: { input: TInput }) => T)`. `slot.value<T>()` accepts only `T`. Both support `.optional()` (default required). The generated builder has chained methods for each slot, plus `.input(schema)` and `.use(mw)`. Set-once is enforced at runtime.

`validateArgs` accepts either a Standard Schema (zod, valibot, arktype, etc.) or `(raw) => TArgs | Promise<TArgs>`. When a schema, the framework auto-merges raw `input` back so the user's args schema only needs to describe routing fields.

## multiTransport

Composes multiple `Transport<TRendered, TData>` into one composite. The result is itself a `Transport<TRendered, TData>` — register it like any other.

```ts
import { multiTransport } from '@betternotify/email/transports'; // pre-parameterized for email
import { smtpTransport } from '@betternotify/smtp';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: smtpTransport({ /* primary */ }) },
    { transport: smtpTransport({ /* backup */ }) },
  ],
});
```

### Strategies

Six strategies cover the common delivery patterns. The first three are _sequential_ — on failure they walk forward through the remaining transports (modulo `n`). The last three are _parallel_ — all transports fire concurrently.

| Strategy        | Concurrency | First pick on each `send()`                       | Use when                                                                                            |
| --------------- | ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `'failover'`    | sequential  | always `transports[0]`                             | Clear primary + backup ordering — prefer the cheap/reliable provider, fall back only on failure.    |
| `'round-robin'` | sequential  | cycles `0, 1, 2, …` via an in-process counter      | Even load distribution across equivalent providers within one process.                              |
| `'random'`      | sequential  | uniformly random index                             | Load spreading without per-process coordination — multiple workers distribute without sharing state. |
| `'race'`        | parallel    | all at once                                        | Latency redundancy — first to succeed wins; the others stay in-flight but their result is ignored.  |
| `'parallel'`    | parallel    | all at once                                        | Verified-redundancy delivery — ALL must succeed (e.g. primary + audit copy). Throws if any fail.   |
| `'mirrored'`    | mixed       | primary awaited; mirrors fire after primary succeeds | Primary + observability mirrors — mirror failures are logged at `warn` and never affect the outcome. |

> Weighted distribution is deferred to v0.3 — the union expands without a breaking change.

### Failover

Always starts at `transports[0]`. On failure, walks forward through the rest. Use when you have a clear primary + backup ordering.

```ts
const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: primaryProvider },
    { transport: backupProvider },
  ],
});
```

### Round-robin

An in-process counter advances after each `send()`, so successive sends start at different indices. On failure, walks forward (modulo `n`). Use for even load distribution across equivalent providers within one process.

```ts
const transport = multiTransport({
  strategy: 'round-robin',
  transports: [
    { transport: providerA },
    { transport: providerB },
    { transport: providerC },
  ],
});
// Send order: A → B → C → A → B → C → …
// If B fails on a given send: tries C, then A
```

### Random

Picks a uniformly random start index on each `send()`, then walks forward (modulo `n`) on failure. Use when you want load spreading without per-process counter coordination — multiple workers distribute naturally without sharing state.

```ts
const transport = multiTransport({
  strategy: 'random',
  transports: [
    { transport: providerA },
    { transport: providerB },
    { transport: providerC },
  ],
});
```

### Race

Dispatches to **all** transports concurrently via `Promise.any()`. Returns the first successful result; the remaining in-flight sends are not cancelled. Throws when all fail (the last error from `AggregateError`). Use for latency redundancy across equivalent providers.

```ts
const transport = multiTransport({
  strategy: 'race',
  transports: [
    { transport: fastProvider },
    { transport: slowFallbackProvider },
  ],
});
// fastest wins; the other stays in-flight but its result is discarded
```

> `maxAttemptsPerTransport` and `backoff` are ignored for parallel strategies.

### Parallel

Dispatches to **all** transports concurrently via `Promise.allSettled()`. Requires ALL to succeed — throws the first failure if any branch fails. Returns the first transport's data as canonical. Use for verified-redundancy delivery (e.g. primary + audit copy, both must succeed).

```ts
const transport = multiTransport({
  strategy: 'parallel',
  transports: [
    { transport: primaryProvider },
    { transport: auditCopyProvider },
  ],
});
```

### Mirrored

Awaits `transports[0]` (primary) and returns its result immediately. The remaining transports are fired in the background — their errors are logged at `warn` and never propagate. If the primary fails, mirrors never run. Use when secondary providers are observability mirrors whose failure must not affect the user-visible outcome.

```ts
const transport = multiTransport({
  strategy: 'mirrored',
  transports: [
    { transport: primaryProvider },     // awaited; failure throws
    { transport: observabilityMirror }, // fire-and-forget; failure only logged
  ],
});
```

### Retry within a transport

Applies to sequential strategies only (`'failover'`, `'round-robin'`, `'random'`).

`maxAttemptsPerTransport` controls how many total attempts are made per transport on a _retriable_ error before advancing (including the initial attempt; so "retries" are `maxAttemptsPerTransport - 1`). Defaults to `1` (no retry). A non-retriable error advances immediately regardless of this value.

`backoff: { initialMs, factor, maxMs }` adds exponential delay between retries on the _same_ transport. Delay formula: `min(maxMs, initialMs × factor^(attempt-1))`. No jitter applied. Backoff resets when advancing to the next transport; advancing between transports never sleeps.

`isRetriable(err) => boolean` lets you advance immediately on certain errors without retrying. Returning `false` still lets the composite try the remaining transports — it does not abort the whole send. Default: `() => true`.

```ts
const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: providerA },
    { transport: providerB },
  ],
  maxAttemptsPerTransport: 3,
  backoff: { initialMs: 100, factor: 2, maxMs: 2000 },
  isRetriable: (err) => err instanceof TimeoutError,
  // providerA attempt delays: 100ms, 200ms → advance to providerB on any non-retriable error
});
```

A failure can be either a thrown error or a returned `{ ok: false, error }` — both trigger the same retry/advance semantics.

### Naming and logging

Use `name` to distinguish composites when you register more than one. The orchestration logger (separate from the per-send `createClient` logger) emits strategy-specific events:

Sequential (`'failover'`, `'round-robin'`, `'random'`):
- `debug` `multi attempt ok` — a transport succeeded
- `warn` `multi attempt failed` — a transport failed; may retry or advance
- `error` `multi exhausted` — all transports failed; about to throw

Race (`'race'`):
- `debug` `multi race winner` — the first transport to succeed
- `warn` `multi race attempt failed` — one concurrent attempt failed
- `error` `multi race exhausted` — all concurrent attempts failed

Parallel (`'parallel'`):
- `debug` `multi parallel branch ok` — a branch succeeded
- `warn` `multi parallel branch failed` — a branch failed
- `error` `multi parallel partial failure` — at least one branch failed; about to throw

Mirrored (`'mirrored'`):
- `debug` `multi mirrored primary ok` — primary transport succeeded
- `warn` `multi mirror failed` — a mirror transport failed (does not affect outcome)

All strategies:
- `error` `multi close failed` — an inner `close()` threw during shutdown

```ts
const transport = multiTransport({
  name: 'failover-bulk',
  strategy: 'failover',
  transports: [{ transport: providerA }, { transport: providerB }],
  logger: consoleLogger({ level: 'debug' }),
});
```

### verify / close

`verify()` runs every inner's `verify?.()` in parallel and reports `{ ok: anyInnerOk, details: { results: [...] } }`. Inner verify throws are captured per-inner and never propagate. `close()` runs every inner's `close?.()` in parallel; individual errors are logged and swallowed.

## createTransport / createMockTransport

Generic builders for the `Transport<TRendered, TData>` contract:

```ts
import { createTransport, createMockTransport } from '@betternotify/core';

const real = createTransport<MyRendered, MyData>({
  name: 'my-api',
  send: async (rendered, ctx) => {
    const res = await fetch('https://api.example.com/send', { body: JSON.stringify(rendered) });
    if (!res.ok) return { ok: false, error: new Error(await res.text()) };
    return { ok: true, data: { id: (await res.json()).id } };
  },
});

const mock = createMockTransport<MyRendered, MyData>({
  reply: (rendered, ctx) => ({ id: `mock-${ctx.messageId}` }),
});
mock.sent; // ReadonlyArray<{ rendered, ctx }>
mock.reset();
```

## Errors

All framework errors extend `NotifyRpcError` and are JSON-serializable. Each carries `code`, `route?`, `messageId?`, plus subclass-specific fields:

| Class                          | Code on instances                       |
| ------------------------------ | --------------------------------------- |
| `NotifyRpcError`               | any of `ErrorCode`                      |
| `NotifyRpcValidationError`     | `'VALIDATION'` + `issues`               |
| `NotifyRpcRateLimitedError`    | `'RATE_LIMITED'` + `key`/`retryAfterMs` |
| `NotifyRpcNotImplementedError` | `'NOT_IMPLEMENTED'`                     |

`ErrorCode` union: `'VALIDATION' | 'PROVIDER' | 'CONFIG' | 'TIMEOUT' | 'RENDER' | 'SUPPRESSED' | 'RATE_LIMITED' | 'NOT_IMPLEMENTED' | 'CHANNEL_NOT_QUEUEABLE' | 'BATCH_EMPTY' | 'UNKNOWN'`.

## License

MIT
