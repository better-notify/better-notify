---
'@emailrpc/core': minor
---

Implement `multiTransport` for production failover and round-robin across multiple transports. Supports per-transport retry with exponential backoff (`maxAttemptsPerTransport`, `backoff`), custom `isRetriable` predicate (defaults to `() => true`), and structured per-attempt logging via `LoggerLike`. `verify()` returns a per-inner report; `close()` swallows individual errors. Adds `'CONFIG'` to the public `ErrorCode` union. Weighted strategy deferred to v0.3.
