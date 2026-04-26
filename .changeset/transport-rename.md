---
'@emailrpc/smtp': minor
'@emailrpc/core': minor
---

Rename `Provider` → `Transport` (and `providers: []` option → `transports: []`). Move `mockProvider` → `mockTransport` and out of `@emailrpc/core/test` into the public `transports` subpath. Delete the `@emailrpc/core/test` subpath export. Add `@emailrpc/smtp` package with nodemailer-backed `smtpTransport()`.
