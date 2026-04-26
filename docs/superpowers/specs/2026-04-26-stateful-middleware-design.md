# Stateful Middleware (Suppression / Rate Limit / Idempotency) — Design

**Date:** 2026-04-26
**Status:** Approved (user-confirmed section-by-section)
**Scope:** `@emailrpc/core` Layer 4 — stateful middleware trio
**Companion specs:** `docs/superpowers/specs/2026-04-25-hooks-middleware-plugins-design.md` (out-of-scope §8.3 fills these in)

---

## 1. Goals

- Replace the three throwing stubs (`withSuppressionList`, `withRateLimit`, `withIdempotency`) with real implementations.
- Define narrow, replaceable storage contracts so users can swap in Redis, Upstash, or any other backend without touching the middleware itself.
- Ship built-in in-memory adapters in `@emailrpc/core` for dev, tests, and single-process use.
- Stay minimal: no peer dependencies added to `@emailrpc/core`.

## 2. Non-goals

- `withTracing` and `withEventLogger` (separate cycles — OTel decisions, sink interface).
- Redis / Upstash / DynamoDB store packages (users implement the type today; first-party packages land later if demand justifies).
- Cross-worker atomic idempotency (`setIfAbsent`) — v1 ships best-effort idempotency.
- Partial-recipient suppression (filter `to/cc/bcc`, send to remaining) — needs middleware `args` mutation capability, deferred.
- Suppression list bulk-admin operations (list, paginate) — managed via direct store access.

## 3. Storage contracts

Three narrow `type`s (no classes, no inheritance), each minimal. Backends just implement the type.

```ts
type SuppressionEntry = { reason: string; createdAt: Date };

type SuppressionList = {
  get(email: string): Promise<SuppressionEntry | null>;
  set(email: string, entry: SuppressionEntry): Promise<void>;
  del(email: string): Promise<void>;
};

type RateLimitStore = {
  record(
    key: string,
    windowMs: number,
    algorithm: 'fixed' | 'sliding',
  ): Promise<{ count: number; resetAtMs: number }>;
};

type IdempotencyStore = {
  get(key: string): Promise<SendResult | null>;
  set(key: string, result: SendResult, ttlMs: number): Promise<void>;
};
```

### 3.1 `SuppressionList`

`reason` is a free-form string — developers use whatever taxonomy fits. Suggested values: `'unsubscribe' | 'bounce' | 'complaint' | 'manual'`. Documented; not enforced.

`add` / `remove` are exposed (as `set` / `del`) so the same store passed to the middleware can be written to by webhook handlers (e.g., SES bounce ingestion lands later as part of the webhook router cycle).

### 3.2 `RateLimitStore`

`record` is a single round-trip "record this attempt and tell me the post-record state." It always records the attempt; the middleware decides whether to block based on `count`.

- **Fixed window**: increment a counter under `key`; on first hit, set `expireAt = now + windowMs`. Returns `count = incremented value`, `resetAtMs = expireAt`.
- **Sliding window**: append `now` to a list/sorted-set under `key`; trim entries older than `now - windowMs`. Returns `count = size after trim`, `resetAtMs = oldestRemainingTimestamp + windowMs`.

Single round-trip avoids races between processes and keeps the Redis path to one or two ops.

### 3.3 `IdempotencyStore`

Plain KV with TTL. No `del` — entries expire naturally. No `setIfAbsent` — v1 best-effort; concurrent first-time sends with the same key both reach the provider. Documented as a limitation; addressable later via type extension.

## 4. Built-in in-memory adapters

All three live in `packages/core/src/stores/` and ship under the `./stores` subpath. Framework-free, no peer dependencies.

- `inMemorySuppressionList(opts?: { seed?: SuppressionEntry })` → `Map<string, SuppressionEntry>`. Optional `seed` for tests.
- `inMemoryRateLimitStore()` → two `Map`s (one for fixed, one for sliding). Trims on every `record`.
- `inMemoryIdempotencyStore()` → `Map<string, { result; expiresAt }>`. Lazy expire on `get`.

Email lookups are case-insensitive — `SuppressionList` implementations normalize via `.toLowerCase()` before keying.

## 5. Middleware contract change

Extend `MiddlewareParams` to expose `args`:

```ts
type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn> = {
  input: TInput;
  ctx: TCtxIn;
  route: string;
  args: RawSendArgs;
  next: (newCtx?: Partial<TCtxOut>) => Promise<SendResult>;
};
```

Required because both `withSuppressionList` (needs `args.to/cc/bcc`) and per-recipient `withRateLimit` keys (needs `args.to`) read recipient data. `args` is conceptually read-only — mutating it would break downstream rendering. Existing middlewares (`withDryRun`, `withTagInject`) remain unaffected; they destructure only what they need.

`client.ts` `composeMiddleware` already has `args` in scope — threading it into each `mw({ ... })` call is one line.

## 6. Middleware contracts

### 6.1 `withSuppressionList`

```ts
type WithSuppressionListOptions = {
  list: SuppressionList;
  logger?: LoggerLike;
  fields?: ReadonlyArray<'to' | 'cc' | 'bcc'>;
};

const withSuppressionList = (opts: WithSuppressionListOptions): Middleware
```

Behavior:
- Collects addresses from `args.to` / `args.cc` / `args.bcc` (subset selectable via `fields`, defaults to all three).
- Calls `list.get(email)` for each (Promise.all).
- If **any** address has a non-null entry → short-circuit. Returns synthetic `SendResult { messageId: 'suppressed', accepted: [], rejected: [...allSuppressedAddresses], envelope: { from: '', to: [...] }, timing: { renderMs: 0, sendMs: 0 } }`.
- Logs `logger.warn({ route, suppressed: [{ email, reason, createdAt }] }, 'email suppressed')` before returning.
- If no addresses match → `return next()`.

"Any match" rather than "all match": v1 simplest, conservative default.

Logger fallback: if `logger` not supplied, use `console.warn` directly (middleware can't see the surrounding client logger today).

### 6.2 `withRateLimit`

```ts
type RateLimitKeyParams<TInput> = {
  input: TInput;
  ctx: unknown;
  route: string;
  args: RawSendArgs;
};

type WithRateLimitOptions<TInput = unknown> = {
  store: RateLimitStore;
  key: string | ((params: RateLimitKeyParams<TInput>) => string);
  max: number;
  window: number;
  algorithm?: 'fixed' | 'sliding';
};
```

Behavior:
- Resolves `key` (string-or-function).
- `await store.record(key, window, algorithm ?? 'fixed')`.
- If `count > max` → throw `EmailRpcRateLimitedError({ key, retryAfterMs: max(0, resetAtMs - now) })`.
- Else → `return next()`.

Error carries `retryAfterMs` so a queue worker can schedule a retry. Pipeline catches it as `phase: 'middleware'` for `onError` reporting.

### 6.3 `withIdempotency`

```ts
type IdempotencyKeyParams<TInput> = RateLimitKeyParams<TInput>;

type WithIdempotencyOptions<TInput = unknown> = {
  store: IdempotencyStore;
  key: string | ((params: IdempotencyKeyParams<TInput>) => string);
  ttl: number;
};
```

Behavior:
- Resolves `key`.
- `const cached = await store.get(key)`. If non-null → return cached result (no `next()` call, no logging by default).
- `const result = await next()`. On success → `await store.set(key, result, ttl)`, then `return result`.
- On `next()` throw → do **not** store anything. Failures aren't idempotent.

Race condition: two concurrent sends with the same key both miss `get`, both call `next()`, both `set`. Last-write-wins; both providers see a send. Documented v1 limitation.

## 7. New error type

```ts
class EmailRpcRateLimitedError extends EmailRpcError {
  readonly key: string;
  readonly retryAfterMs: number;
}
```

`EmailRpcError.code` union grows by `'RATE_LIMITED'`. No suppression-specific error (suppression short-circuits silently). No idempotency-specific error.

## 8. Module layout

```
packages/core/src/
  middlewares/
    types.ts                        (extend MiddlewareParams with args)
    withSuppressionList.ts          (replaces stub)
    withSuppressionList.test.ts     (new)
    withSuppressionList.types.ts    (rewritten)
    withRateLimit.ts                (replaces stub)
    withRateLimit.test.ts           (new)
    withRateLimit.types.ts          (rewritten)
    withIdempotency.ts              (replaces stub)
    withIdempotency.test.ts         (new)
    withIdempotency.types.ts        (rewritten)
    stubs.test.ts                   (shrunk to withTracing + withEventLogger only)
  stores/
    types.ts
    inMemorySuppressionList.ts
    inMemorySuppressionList.test.ts
    inMemoryRateLimitStore.ts
    inMemoryRateLimitStore.test.ts
    inMemoryIdempotencyStore.ts
    inMemoryIdempotencyStore.test.ts
    index.ts
  errors.ts                         (add EmailRpcRateLimitedError + 'RATE_LIMITED' code)
  client.ts                         (thread args into composeMiddleware mw call)
  index.ts                          (export error + middleware option types)
```

Subpath `./stores` added to `packages/core/package.json`.

## 9. Tests

Per-store: round-trip get/set/del, TTL expiry, sliding-window trim correctness.

Per-middleware: short-circuit / throw / replay paths against the in-memory store, using `mockTransport` to verify whether the provider was called.

End-to-end: one "kitchen sink" test in `client.test.ts` chaining `withRateLimit` → `withSuppressionList` → `withIdempotency` to verify ordering interactions are sane (suppression short-circuit doesn't write idempotency state; rate-limit throw doesn't write idempotency state).

## 10. Out of scope (and how this design accommodates them later)

| Item | How this design leaves room |
|---|---|
| `setIfAbsent` for atomic idempotency | New optional method on `IdempotencyStore`. Backwards compatible. |
| Partial-recipient suppression | Needs middleware `args` mutation. Tracked in the broader middleware-mutation cycle. |
| `@emailrpc/redis` (or similar) | Implements the three types; ships as separate package. No core changes. |
| Webhook-driven suppression list updates | The `set` op on `SuppressionList` already serves this; webhook router cycle wires bounces → `list.set(email, { reason: 'bounce', createdAt })`. |
| `withTracing` | Separate cycle, OTel decisions. |
| `withEventLogger` | Separate cycle, sink interface. |

## 11. Acceptance criteria

- All stubs.test.ts checks for the three stateful middlewares removed; `withTracing` and `withEventLogger` still throw.
- New tests in §9 pass.
- `pnpm ci` green from repo root.
- Existing examples / call sites unchanged.
