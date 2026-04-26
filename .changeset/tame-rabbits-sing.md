---
'@emailrpc/core': minor
---

Add built-in structured logging to core. `createClient` accepts `logger?: LoggerLike`; defaults to `consoleLogger({ level: 'warn' })`. Pino interop via `fromPino`. Removes unreleased `loggerMw` and `loggerPlugin` stubs.
