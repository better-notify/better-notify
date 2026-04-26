# multiTransport Design

> **Status:** Approved 2026-04-26. Ready for plan.

## Goal

Replace the `multiTransport` stub at `packages/core/src/transports/multi.ts` with a production-grade composite `Transport` that orchestrates failover and round-robin across multiple inner transports. This is the orchestration half of the "know your sending limits" story: when a provider rejects a message (rate limit, outage, transient error), multiTransport advances to the next configured transport so mail still goes out.

Layered below `createClient`: multiTransport returns a single `Transport`, registered like any other transport entry. The client never knows it's composite.

## Non-goals

- **Weighted distribution** (deferred to v0.3). The `weight?` field on `MultiTransportEntry` is removed for v0.2 and re-added later as optional without breaking the API — `MultiTransportStrategy` is a string union, so adding `'weighted'` is non-breaking.
- **Per-transport retry policy as its own concern.** `multiTransport` accepts a built-in retry knob for ergonomic reasons (most users want one orchestrator), but it does not replace a future `withRetry` middleware that operates on the full send pipeline.
- **Cross-process round-robin coordination.** Counter is in-process. Cross-process distribution is the queue's job (Layer 5).
- **Provider-specific `isRetriable` heuristics in core.** Provider packages (`@emailrpc/resend`, `@emailrpc/ses`) own their own helpers.
- **Wrapping or transforming errors.** Composite throws the raw inner-transport error so existing `onError` hooks see the same shape they would from a single transport.

## Public API

```ts
import type { LoggerLike } from '../logger.js';
import type { Transport } from './types.js';

export type MultiTransportStrategy = 'failover' | 'round-robin';

export type MultiTransportEntry = {
  transport: Transport;
};

export type MultiTransportOptions = {
  name?: string;
  strategy: MultiTransportStrategy;
  transports: MultiTransportEntry[];
  maxAttemptsPerTransport?: number;
  backoff?: { initialMs: number; factor: number; maxMs: number };
  isRetriable?: (err: unknown) => boolean;
  logger?: LoggerLike;
};

export const multiTransport: (opts: MultiTransportOptions) => Transport;
```

Returned `Transport`:

- `name`: defaults to `"multi"`. Override via `opts.name` so users can register two composites under different names in the same client.
- `send(message, ctx)`: orchestrates per the strategy and retry policy. Returns the successful inner's `TransportResult` unchanged.
- `verify()`: parallel; returns `{ ok: anyInnerOk, details: { results: [{ name, ok, details? }] } }`.
- `close()`: parallel; swallows individual errors and logs them at `error` level. Always resolves.

Defaults:

- `maxAttemptsPerTransport`: `1` (= immediate failover, no per-transport retry)
- `isRetriable`: `() => true` (every error retriable)
- `logger`: `consoleLogger()` (silent at warn-default unless reconfigured)
- `backoff`: unset (retries fire back-to-back when `maxAttemptsPerTransport > 1` and no backoff is configured)

Construction-time validation (synchronous throw):

| Condition | Error |
|---|---|
| `transports.length === 0` | `new EmailRpcError({ code: 'CONFIG', message: 'multiTransport requires at least one transport' })` |
| `maxAttemptsPerTransport < 1` | `new EmailRpcError({ code: 'CONFIG', message: 'maxAttemptsPerTransport must be >= 1' })` |
| `backoff.initialMs <= 0` or `backoff.factor < 1` or `backoff.maxMs < backoff.initialMs` | `new EmailRpcError({ code: 'CONFIG', message: 'invalid backoff config' })` |

The current `ErrorCode` union (`packages/core/src/errors.ts`) does not include `'CONFIG'` — the implementation plan adds `'CONFIG'` to the union as a one-line change; no new subclass needed.

## Send orchestration

```text
order = strategy === 'failover'
  ? [0, 1, ..., n-1]
  : rotateRoundRobin()           # [i, i+1, ..., i+n-1] mod n; counter increments per send() call

let lastErr: unknown
for transportIndex of order:
  for attempt of 1..maxAttemptsPerTransport:
    [result, err] = await handlePromise(transport.send(message, ctx))
    if !err:
      log.debug('multi attempt ok', { transportName, attempt, strategy })
      return result
    lastErr = err
    log.warn('multi attempt failed', { err, transportName, attempt, retriable: isRetriable(err) })
    if !isRetriable(err):
      break attempts loop, advance to next transport
    if attempt < maxAttemptsPerTransport:
      await sleep(computeBackoff(attempt, opts.backoff))
    else:
      advance to next transport
log.error('multi exhausted', { attempts: total, lastErr })
throw lastErr
```

### Key behaviors

- **Round-robin counter advances per `send()` call**, not per attempt. So `send()` #1 starts at transport[0], `send()` #2 starts at transport[1], etc. Failover within a single send walks forward from the start index, wrapping modulo n. Every send tries every transport at most `maxAttemptsPerTransport` times before throwing.
- **Non-retriable error advances to the next transport**, it does not abort the whole send. Different providers have different validation; transport[1] may accept what transport[0] rejected. Users who want hard-stop behavior wrap multiTransport upstream.
- **`lastErr` is what gets thrown** — the most recent inner error, raw, not wrapped. Existing `onError` hooks see the same error class they would from a single transport.
- **Backoff**: `delay = min(maxMs, initialMs * factor^(attempt-1))`. No jitter in v1 (YAGNI). When `maxAttemptsPerTransport === 1`, backoff is never consulted.
- **`SendContext` passed through unchanged** to each inner. Inner transports stay stateless.
- **Sync throws and rejected promises** treated identically via `handlePromise`.
- **`TransportResult` with non-empty `rejected`** is a successful send with partial recipient rejection (per the `Transport` contract). multiTransport returns it as-is and does not retry — rejected recipients are a delivery concern, not orchestration.

## Logging

multiTransport uses its **own** bound logger (`{ component: 'multi-transport', name: opts.name ?? 'multi' }`), independent of the `client.ts` per-send logger. Inner-transport-level logging from createClient still fires; from the client's perspective, multiTransport is a single transport with `name: "multi"` (or `opts.name`).

| Level | Message | Payload |
|---|---|---|
| `debug` | `multi attempt ok` | `{ transportName, attempt, strategy }` |
| `warn` | `multi attempt failed` | `{ err, transportName, attempt, retriable }` |
| `error` | `multi exhausted` | `{ attempts, lastErr }` |
| `error` | `multi close failed` | `{ err, transportName }` (during `close()`) |

The client's `send ok` log records `transportName: "multi"` (or `opts.name`). Per-attempt visibility lives in the multi-transport logger. We deliberately do **not** surface the winning inner transport name on the client log line — keeps the abstraction clean. If users need this for billing or attribution, a follow-up can add an optional callback.

## verify() and close() semantics

### `verify()`

```ts
verify(): Promise<{ ok: boolean; details: { results: Array<{ name: string; ok: boolean; details?: unknown }> } }>
```

- Calls every inner's `verify?.()` in parallel via `handlePromise`.
- Inner without a `verify` method → `{ name, ok: true }` (no method = trivially healthy).
- Inner verify resolves → its `{ ok, details }` carried through.
- Inner verify throws → `{ name, ok: false, details: err }`. Composite never throws from `verify`.
- Top-level `ok` is `true` iff at least one inner is `ok`. Rationale: the orchestrator only needs one path to function. Per-transport health visible in `details.results` for ops.

### `close()`

- Calls every inner's `close?.()` in parallel.
- Inner without a `close` method → skipped silently.
- Errors logged at `error` level via the injected logger and swallowed. Composite always resolves.
- Rationale: `close()` is best-effort cleanup, often called inside another error path. Throwing here would mask the original cause.

## File structure

```
packages/core/src/transports/
  multi.ts              # multiTransport() implementation (rewrite)
  multi.types.ts        # MultiTransportEntry, MultiTransportOptions, MultiTransportStrategy
  multi.test.ts         # full test suite (rewrite)
  index.ts              # barrel — add MultiTransportStrategy export
  types.ts              # unchanged
  utils.ts              # unchanged
```

Internal helpers stay private inside `multi.ts`:

- `buildOrder(strategy, n, counterRef)` — returns iteration order for one send
- `computeBackoff(attempt, cfg)` — pure function, returns ms
- `runVerify(inner)` — wraps inner's `verify?.()` in `handlePromise`, never throws
- `runClose(inner, log)` — wraps inner's `close?.()`, logs and swallows errors

## Testing strategy

Unit tests in `packages/core/src/transports/multi.test.ts`. All against fake transports — no real network, vitest fake timers for backoff sleeps. TDD per project convention.

**Fixture:** `fakeTransport(name, behavior)` local to the test file, where `behavior` is a queue of `'ok' | Error | (attempt) => 'ok' | Error`. Pops one per call, records every call for ordering assertions.

### Coverage matrix

**Construction**

1. throws `EmailRpcError` with `code: 'CONFIG'` on empty `transports`
2. throws on `maxAttemptsPerTransport < 1`
3. throws on invalid `backoff` (each of: `initialMs <= 0`, `factor < 1`, `maxMs < initialMs`)
4. returns a `Transport` with `name: "multi"` by default, overridable via `opts.name`

**Failover strategy**

5. all retriable failures across all transports → throws `lastErr`, calls each inner once
6. transport[0] succeeds → transport[1] never called
7. transport[0] throws retriable, transport[1] succeeds → returns transport[1]'s result; both called in order
8. transport[0] throws non-retriable (per `isRetriable`) → advances to transport[1]; logs `retriable: false`
9. `maxAttemptsPerTransport: 3` → transport[0] called 3 times before advancing on retriable errors

**Round-robin strategy**

10. counter advances per `send()` call: 4 sends across 2 transports → call counts `[2, 2]`
11. round-robin + failover: send #1 starts at [0] then walks to [1]; send #2 starts at [1] then walks to [0]
12. round-robin + transport[start] succeeds → others never called

**Backoff**

13. `backoff` + `maxAttemptsPerTransport: 3` → fake timers assert delays follow `min(maxMs, initialMs * factor^(attempt-1))` between attempts on the same transport; no delay between transports
14. no `backoff` config + retries → no `setTimeout` scheduled

**isRetriable**

15. custom predicate → non-matching errors still advance (matches section-2 decision)
16. default predicate → every error retriable

**verify()**

17. all inner verify ok → `{ ok: true, details: { results: [...] } }`
18. one inner ok, others fail → `{ ok: true, details: ... }`
19. no inner ok → `{ ok: false, details: ... }`
20. inner without `verify` → `{ name, ok: true }`
21. inner verify throws → `{ name, ok: false, details: err }`; composite does not throw

**close()**

22. all inners' `close()` resolve → composite resolves
23. one inner's close throws → logged at error level via injected `memoryLogger`; composite still resolves
24. inner without `close` → skipped silently

**Logging**

25. `multi attempt ok` debug record fires on success with `{ transportName, attempt, strategy }`
26. `multi attempt failed` warn record fires on every failure with `{ err, transportName, attempt, retriable }`
27. `multi exhausted` error record fires once when all transports/attempts done with `{ attempts, lastErr }`
28. logger defaults to `consoleLogger()` when `opts.logger` not set — assert via `console.warn` spy

**Integration smoke** (one test against `createClient`)

29. `createClient({ transports: [{ name: 'composite', transport: multiTransport({ strategy: 'failover', transports: [fakeFailing, fakeOk] }), priority: 1 }] })` → `client.welcome.send(...)` resolves; client's `send ok` log records `transportName: "composite"`.

Coverage target: 100% lines/branches in `multi.ts`.

## Touch list

**Modify**

- `packages/core/src/transports/multi.ts` — replace stub with full implementation
- `packages/core/src/transports/multi.types.ts` — drop `weight?`, add `MultiTransportStrategy`, `name?`, `maxAttemptsPerTransport?`, `backoff?`, `logger?`
- `packages/core/src/transports/multi.test.ts` — replace stub-failing test with full suite
- `packages/core/src/transports/index.ts` — add `MultiTransportStrategy` re-export
- `packages/core/src/errors.ts` — add `'CONFIG'` to the `ErrorCode` union
- `plan/emailrpc-spec.md` — update §7 multi example: drop `weight`, drop `provider`/`providers` legacy wording, add `maxAttemptsPerTransport` + `backoff` example

**Add**

- `.changeset/<random>.md` — `@emailrpc/core` minor bump

No new files, no deletes, no moves.

## Open follow-ups (out of scope)

- Weighted strategy (v0.3, when traffic-splitting use cases land)
- Jitter on backoff (when retry storms become observable)
- Surfacing winning inner transport name on the client `send ok` log line (when billing/attribution use cases land)
- `withRetry` middleware (separate concern; multiTransport's retry is a per-transport ergonomic, not a pipeline-level retry policy)
