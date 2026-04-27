# @emailrpc/core

Channel-agnostic notification infrastructure: contracts, client pipeline, transport factories, middleware, hooks, plugins, and observability primitives. See the [root README](../../README.md) for the high-level overview and quick-start.

## Install

```sh
pnpm add @emailrpc/core
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
import { defineChannel, slot } from '@emailrpc/core';
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
import { multiTransport } from '@emailrpc/email/transports'; // pre-parameterized for email
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

`maxAttemptsPerTransport` controls how many times a single inner is retried on a _retriable_ error before advancing. `backoff: { initialMs, factor, maxMs }` gives exponential delay between retries on the same transport (no jitter). `isRetriable(err) => boolean` lets you advance immediately on non-retriable errors. Defaults: `maxAttemptsPerTransport=1` (no retry), `isRetriable=() => true`.

A failure can be either:

- A thrown error from the inner `send()`
- A returned `{ ok: false, error }` (soft failure — same retry/advance semantics as a throw)

### verify / close

`verify()` runs every inner's `verify?.()` in parallel and reports `{ ok: anyInnerOk, details: { results: [...] } }`. Inner verify throws are captured per-inner and never propagate. `close()` runs every inner's `close?.()` in parallel; individual errors are logged and swallowed.

## createTransport / createMockTransport

Generic builders for the `Transport<TRendered, TData>` contract:

```ts
import { createTransport, createMockTransport } from '@emailrpc/core';

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
