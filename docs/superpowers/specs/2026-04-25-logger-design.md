# Logger — Design

Status: Draft · Date: 2026-04-25

## Goals

1. Logging is **first-class internal observability** built into `@emailrpc/core`, not an opt-in plugin. Core itself emits structured events at every send-pipeline phase so users can debug behavior without wiring anything up.
2. Users can **bring their own logger** (pino, winston, bunyan, datadog, custom) by passing any object that satisfies a structural `LoggerLike` type.
3. **Zero hard dependency** on pino — same philosophy as Standard Schema for validators. Pino interop is a one-line adapter, not a runtime requirement.

## Non-goals

- Metrics or tracing (separate concerns; `tracingMw` and Prometheus helpers stay outside this design).
- Log shipping / transport configuration. That is the user's logger's job.

## The `LoggerLike` contract

Lives in `packages/core/src/logger.ts` (new file). The existing `LoggerLike` in `middleware.ts` moves here.

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LoggerLike = {
  debug(message: string, payload?: object): void;
  info(message: string, payload?: object): void;
  warn(message: string, payload?: object): void;
  error(message: string, payload?: object): void;
  child(bindings: object): LoggerLike;
};
```

- Method signature is `(message, payload?)` — message-first, opposite of pino's native `(obj, msg)` order. This matches `console.*` mental models and keeps internal call sites readable.
- `child(bindings)` is **required** on the contract. It returns a `LoggerLike` whose calls merge `bindings` into every payload. Console adapter ships one (~10 lines); pino/winston/bunyan all support `.child` natively.

### Error convention

**Errors always go under the `err` key, never `error`.**

Pino's default `stdSerializers.err` only fires on the `err` key and only on actual `Error` instances. Naive spreading of `{ error }` makes pino render `{}`.

```ts
log.error('send failed', { err, durationMs, providerName });
```

- Pino-wrapped users get `{ type, message, stack, code, cause }` for free.
- The console adapter serializes the value at the `err` key (when it is an Error) into `{ type, message, stack, cause?, code? }`. Other Error-typed values in the payload are passed through untouched — callers must use the `err` key to opt into serialization.
- Internal `ErrorCtx` hook payloads keep their existing `error` field on the public typed surface (unchanged public API). When those payloads get logged, core maps `error → err` at the log boundary. One adapter, one rule, no leakage.

## Console adapter

```ts
export type ConsoleLoggerOptions = {
  level?: LogLevel;
};

export const consoleLogger = (opts?: ConsoleLoggerOptions): LoggerLike;
```

- Default `level: 'warn'`.
- Filters by level, calls the matching `console.*` method, passes `(message, { ...bindings, ...payload })` so structure is preserved in dev output.
- `child(bindings)` returns a new instance whose internal bindings are merged-and-frozen with the parent's.

## Pino interop

Optional one-liner helper:

```ts
export const fromPino = (pino: PinoLike): LoggerLike => ({
  debug: (msg, payload) => pino.debug(payload ?? {}, msg),
  info: (msg, payload) => pino.info(payload ?? {}, msg),
  warn: (msg, payload) => pino.warn(payload ?? {}, msg),
  error: (msg, payload) => pino.error(payload ?? {}, msg),
  child: (bindings) => fromPino(pino.child(bindings)),
});
```

`PinoLike` is a structural shape — no runtime pino dep, no peer dep.

## Configuration surface

Same option name (`logger`), same shape, every entry point that owns a pipeline:

```ts
createClient({ router, providers, logger?, ... })
createWorker({ router, provider, queue, logger?, ... })
createWebhookRouter({ routes, logger?, ... })
```

- `logger?: LoggerLike` — if omitted, core constructs `consoleLogger({ level: 'warn' })` internally.
- Users tune the default level by passing `logger: consoleLogger({ level: 'debug' })` explicitly. **No separate `logLevel` option** — one knob lives on the logger instance, which is where every real logger puts it anyway.
- Inside core, the passed-in (or defaulted) logger is wrapped with `logger.child({ component: 'client' | 'worker' | 'webhook' })` immediately so multi-component apps can filter by component.
- Per-send, the pipeline creates another child: `logger.child({ route, messageId })`. Every internal log line inside that send carries those bindings automatically.

Worker and webhook router are stubs today; the `logger` option is wired into their type signatures up front so future internal calls are non-breaking.

## Internal call sites

Per send, with the child logger bound to `{ component: 'client', route, messageId }`:

| Phase | Level | Message | Extra payload |
|---|---|---|---|
| send entry | `debug` | `'send start'` | `{ to, hasInput: !!input }` |
| validate fail | `warn` | `'validate failed'` | `{ err, issues }` |
| middleware short-circuit | `debug` | `'middleware short-circuited'` | `{ at: mwName }` |
| middleware throw | `warn` | `'middleware error'` | `{ err, at: mwName }` |
| render start | `debug` | `'render start'` | `{ adapter }` |
| render fail | `warn` | `'render failed'` | `{ err, adapter, durationMs }` |
| provider attempt | `debug` | `'provider send'` | `{ providerName, attempt }` |
| provider fail (will retry next) | `warn` | `'provider failed, falling over'` | `{ err, providerName, nextProvider }` |
| provider fail (final) | `error` | `'send failed'` | `{ err, providerName, durationMs }` |
| send success | `info` | `'send ok'` | `{ providerName, durationMs, providerMessageId }` |
| hook throw | `error` | `'hook failed'` | `{ err, hook }` — never propagates; hooks are observational |

Worker (slots reserved): `'job picked'` debug · `'job revalidated mismatch → DLQ'` warn · `'job processed'` info · `'job failed'` error.

Webhook (slots reserved): `'webhook received'` debug · `'signature invalid'` warn · `'webhook handled'` info · `'webhook handler error'` error.

**Behavior at default `level: 'warn'`**: a healthy app is silent. A misbehaving one emits exactly the failure context you would want without flipping any switch. `level: 'debug'` gives full per-phase trace.

## Migration

Both existing stubs become redundant once core logs internally — keeping them creates two ways to do the same thing.

- **Delete** `loggerMw` and `LoggerMwOptions` from `packages/core/src/middleware.ts`. Move `LoggerLike` to `logger.ts`.
- **Delete** `packages/core/src/plugins/logger.ts`. The hook handlers it provides now live in core's send pipeline.
- **Public exports**: add `consoleLogger`, `LoggerLike`, `LogLevel`, `fromPino` to `@emailrpc/core` and to a new `./logger` subpath export, mirroring the existing `./middleware`, `./template`, etc. pattern.
- **Spec update**: `plan/emailrpc-spec.md` lists `loggerMw` in the middleware table — replace that row with a paragraph in the observability section explaining that logging is built into core and how to swap loggers.
- **Changeset**: minor bump (additive public API + removal of unreleased stubs). Pre-1.0, this is fine.

## Testing

Ship a `memoryLogger()` test helper from `@emailrpc/core/test`. Tests pass it as `logger` and assert against the captured records.

```ts
export type LogRecord = {
  level: LogLevel;
  message: string;
  bindings: object;
  payload: object;
};

export type MemoryLogger = LoggerLike & {
  records: ReadonlyArray<LogRecord>;
  clear(): void;
};

export const memoryLogger = (): MemoryLogger;
```

- `child(bindings)` returns a child that pushes into the same parent `records` array with `bindings` merged. One assertion surface for the whole pipeline.
- Error normalization (`error → err`) is applied at the boundary, so tests can assert `record.payload.err instanceof EmailRpcError` directly.

Coverage:

1. **`logger.test.ts`** — `consoleLogger` level filtering, `child` binding-merge semantics, `Error` formatting in payloads.
2. **`client.test.ts`** — for each phase in the call-sites table: trigger that phase, assert the matching record exists with the right level / message / bindings (including auto-bound `route` and `messageId`).
3. **Default behavior** — no `logger` passed: silent on success, exactly one `error` record on a forced send failure (assert via spying on `console.error`).
4. **Type-level (`*.test-d.ts`)** — confirm `pino()` (via `fromPino`) and `consoleLogger()` both structurally satisfy `LoggerLike`.
