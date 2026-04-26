---
'@emailrpc/core': minor
---

Layer 4 middleware completion.

- Stateful middleware: `withSuppressionList`, `withRateLimit`, `withIdempotency` with three storage contracts (`SuppressionList`, `RateLimitStore`, `IdempotencyStore`) under the new `@emailrpc/core/stores` subpath. Built-in in-memory adapters plus `createSuppressionList` and `createIdempotencyStore` factories for BYO backends.
- Observability middleware: `withEventLogger` (under new `@emailrpc/core/sinks` subpath, with `inMemoryEventSink` and `consoleEventSink`) and `withTracing` (under new `@emailrpc/core/tracers` subpath, with `inMemoryTracer` and a `TracerLike` type structurally compatible with `@opentelemetry/api`).
- New `EmailRpcRateLimitedError` (`code: 'RATE_LIMITED'`) carries `key` and `retryAfterMs` so retry layers can back off precisely.
- `MiddlewareParams` now exposes `args` and `messageId` so middleware can read recipient data and emit correlated events.
- `.use()` on builders now propagates the validated input type from the schema slot, so middleware key functions get a typed `input` after `.input(schema)`.
