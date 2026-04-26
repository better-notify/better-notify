# Catalog Rename & Factory Refactor — Design

Status: Draft
Date: 2026-04-26
Owner: Lucas

## Summary

Rename the Layer 1 aggregation primitive from `router` to `catalog` across `@emailrpc/core` and adapter packages. Replace the `emailRpc.init<Ctx>()` two-step entry point with a single `createEmailRpc<Ctx>()` factory. Add nested catalog composition so emails can be defined in modules and merged into a single typed surface.

The motivation is naming clarity: the aggregation is not an HTTP router and was never intended to be one. It is a typed contract describing a fixed set of email procedures — closer to a catalog of templates than to a request dispatcher. The current name leaks tRPC vocabulary into a domain where it doesn't fit (logs, queue jobs, webhook correlation IDs all read better as `transactional.welcome` than as a "router path"). The factory rename removes a redundant `.init()` step and brings the entry point in line with the rest of the public API (`createClient`, `createTransport`, `createWorker`).

## Goals

- Rename `EmailRouter` → `EmailCatalog` and all derived names (`AnyEmailRouter`, `RouterMap`, `ValidateRouter`, `createRouter`, builder method `.router()`, factory field `router:`).
- Replace `emailRpc.init<Ctx>()` with `createEmailRpc<Ctx>()` returning the same root-builder shape.
- Add nested catalog composition: `rpc.catalog({...})` accepts both email procedures and sub-catalogs at any key, recursing into a single dot-pathed surface.
- Update **every example** under `examples/**` (every `.ts` file that imports from `@emailrpc/core` or constructs a router/client/worker), plus every test, fixture, plan doc, README, and the canonical spec (`plan/emailrpc-spec.md`). Examples are first-class — they are the on-ramp users copy from, so any drift between the new API and the example code is a release blocker.
- Keep `createWebhookRouter` as-is — webhook routing is a genuinely HTTP-shaped concern and the name is correct there.

## Non-goals

- No runtime behavior change for sending, rendering, queueing, middleware, hooks, plugins, or transports.
- No changes to per-procedure builder API (`.email().input().subject().template()` stays identical).
- No changes to `createClient` send-call shape (`mail.<key>.send/render/queue` stays identical for non-nested catalogs).
- No backwards-compatibility shims or aliases. This is a clean rename in v0.1.0-alpha — pre-1.0 breaking changes are explicitly allowed by the project status.
- No deprecation cycle for `emailRpc.init`. It is removed outright.

## Public API after the change

### Factory and builder

```ts
import { createEmailRpc } from '@emailrpc/core';

type Ctx = { tenantId: string };

const rpc = createEmailRpc<Ctx>();

const welcome = rpc.email()
  .input(z.object({ name: z.string() }))
  .subject(({ input }) => `Welcome, ${input.name}`)
  .template(reactEmail(WelcomeTemplate));

const passwordReset = rpc.email()
  .input(z.object({ token: z.string() }))
  .subject('Reset your password')
  .template(reactEmail(ResetTemplate));

const catalog = rpc.catalog({ welcome, passwordReset });
```

`rpc` is the conventional variable name for the root builder. It exposes:

- `rpc.email(): EmailBuilder<Ctx>` — start a procedure builder
- `rpc.use(mw): RootBuilder<NewCtx>` — add root middleware (chainable, narrows Ctx)
- `rpc.catalog(map): EmailCatalog<...>` — finalize a catalog (recursive; see below)

### Nested catalog composition

`rpc.catalog({...})` accepts a map whose values are either email procedures (the output of `rpc.email()...template(...)`) or other catalogs (the output of a previous `rpc.catalog({...})` call). Sub-catalogs are flattened into a nested object whose call-site shape mirrors the input.

```ts
// transactional.ts
const rpc = createEmailRpc<Ctx>();
export const transactional = rpc.catalog({
  welcome: rpc.email()...,
  passwordReset: rpc.email()...,
});

// marketing.ts
const rpc = createEmailRpc<Ctx>();
export const marketing = rpc.catalog({
  newsletter: rpc.email()...,
});

// app.ts
const rpc = createEmailRpc<Ctx>();
const catalog = rpc.catalog({
  transactional,
  marketing,
  systemAlert: rpc.email()...,
});

const mail = createClient({ catalog, transport });

await mail.transactional.welcome.send({ to, input });
await mail.marketing.newsletter.send({ to, input });
await mail.systemAlert.send({ to, input });
```

The catalog map is a discriminated union at the value level: each value is either `AnyEmailDefinition` or `AnyEmailCatalog`. The validator type (`ValidateCatalog<M>`) recurses through sub-catalogs and rejects malformed entries the same way `ValidateRouter` does today.

### Stable IDs become dot-paths

The flattened identifier of an email is its dot-joined key path from the root catalog. This identifier is the canonical email ID used in:

- Logger `route` field on per-send child loggers
- BullMQ job names (and any future queue adapter)
- Webhook event correlation when reconciling sends with provider events
- Render output cache keys (when added in a future layer)

Example: `mail.transactional.welcome.send(...)` logs `route: "transactional.welcome"`.

**Renaming a sub-catalog key is therefore a breaking change for queued jobs and observability dashboards.** This is documented in the migration notes; the tradeoff vs flat names is intentional (collision safety, hierarchical observability).

### Context constraint across merges

All sub-catalogs merged into a parent must share the same `Ctx`. Two catalogs built with different context types fail at compile time during the merge. This matches today's behavior (a router has a single `Ctx`) and is the correct constraint — middleware composition only makes sense within a uniform context.

### `createClient` and `createWorker`

Both factories rename their `router` field to `catalog`. Send-call shape at non-nested keys is unchanged. For nested catalogs, the per-email proxy chain follows the catalog's nesting.

```ts
// Before
createClient({ router, transport, ... });
createWorker({ router, queue, ... });

// After
createClient({ catalog, transport, ... });
createWorker({ catalog, queue, ... });
```

### `createWebhookRouter`

Unchanged. Webhook routing is HTTP-shaped (provider POSTs land on a path, get verified, dispatched). The `router` name is correct in that layer and stays.

## Type-level changes

Renames inside `@emailrpc/core`:

| Before | After |
|---|---|
| `EmailRouter<M, Ctx>` | `EmailCatalog<M, Ctx>` |
| `AnyEmailRouter` | `AnyEmailCatalog` |
| `RouterMap` | `CatalogMap` |
| `ValidateRouter<M>` | `ValidateCatalog<M>` (recursive over sub-catalogs) |
| `createRouter` (internal) | `createCatalog` (internal) |
| `RootBuilder<Ctx>.router(map)` | `RootBuilder<Ctx>.catalog(map)` |
| `EmailRpc.init<Ctx>()` | removed |
| `emailRpc` singleton | removed |
| `InitOptions` type | removed |

Added:

- `createEmailRpc<Ctx = {}>(): RootBuilder<Ctx>` — the new factory function
- `AnyEmailCatalog` accepts both email definitions and other catalogs at the value level via the recursive `ValidateCatalog`
- `EmailCatalog<M, Ctx>` carries a tagged brand so the validator can distinguish a sub-catalog from an email definition at type level

The brand is required because `EmailDefinition` and `EmailCatalog` are both plain object shapes at runtime; the tag (e.g. `_kind: 'catalog'` non-enumerable) lets the recursive validator and the runtime flattener tell them apart without relying on structural shape.

## Runtime changes

Minimal. The current `createRouter` is a near-pass-through over the input map. The new `createCatalog` does the same plus a recursive flatten step that:

1. Walks the input map.
2. For each value that is a sub-catalog (detected via the kind brand), recurses into it and prefixes its keys with the current key + `.`.
3. For each value that is an email definition, stores it under the joined path.
4. Returns the flattened registry alongside the original nested shape (the nested shape is what `createClient`'s proxy uses to build `mail.transactional.welcome`; the flat registry is what worker, logger, and webhook code consume by ID).

Both shapes live on the catalog object behind the brand. Consumers pick the one they need.

No changes to the per-send pipeline, transport contract, middleware/hook ordering, queue payload shape, or webhook verification.

## Migration scope

Mechanical rename across the repo. Every file in the table below needs touching:

| Area | Files |
|---|---|
| Core source | `packages/core/src/init.ts` (delete), `packages/core/src/router.ts` → `catalog.ts`, `packages/core/src/builder.ts`, `packages/core/src/client.ts`, `packages/core/src/sender.ts`, `packages/core/src/worker.ts`, `packages/core/src/webhook.ts`, `packages/core/src/index.ts` (re-exports), `packages/core/src/plugins/types.ts`, `packages/core/src/transports/multi.types.ts`, `packages/core/src/transports/multi.ts` |
| Core tests | `router.test.ts` → `catalog.test.ts`, `builder.test.ts`, `client.test.ts`, `sender.test.ts`, `template.test.ts`, `worker.test.ts`, `config.test.ts`, `plugins/types.test.ts`, `lib/test-utils.test.ts` |
| Internal fixtures | `internal/fixtures/welcome.ts` |
| Examples | **Every file** under `examples/**`, including but not limited to `examples/welcome-text/apps/cli/src/examples/*.ts` (single, smtp, multi-failover, multi-random, multi-round-robin, dry-run, react-email, kitchen-sink, with-observability, rate-limited), `examples/welcome-text/apps/cli/src/index.ts`, any test-utils, and any future example added before this lands. Verify with `grep -rn "emailRpc\|\.router(\|\brouter:" examples/` returning zero hits before declaring the migration complete. |
| Adapter packages | `packages/react-email/README.md` (and any source touching the type names) |
| Docs | `CLAUDE.md`, `README.md`, `plan/emailrpc-spec.md`, `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md` (existing specs reference the old names — leave historical specs alone, but update the canonical spec and the active plan docs) |
| Changesets | New changeset entry under `.changeset/` describing the rename as a breaking change |

The only file we explicitly do not edit is historical spec documents that have already shipped (e.g. older design docs in `docs/superpowers/specs/` that describe past decisions). Those are historical record. The canonical spec `plan/emailrpc-spec.md` is updated.

## Error and edge cases

- **Duplicate top-level keys in a single `rpc.catalog({...})` call** — caught by TypeScript at the object-literal level (existing behavior). No runtime check needed.
- **Cross-catalog name collision after merge** — impossible with namespaced merge (parent key disambiguates), so no detection needed.
- **Context mismatch on merge** — caught at compile time by the recursive validator. The error surface is the same shape as today's `ValidateRouter` mismatch.
- **Empty catalog (`rpc.catalog({})`)** — allowed (matches today's empty router). Useful as a starting point for programmatic composition.
- **Sub-catalog produced by a different `createEmailRpc` instance** — allowed as long as the brand and `Ctx` match. Two `createEmailRpc<SameCtx>()` calls produce structurally identical builders; nothing in the runtime ties a catalog to its origin builder.

## Testing approach

TDD per the project convention. Each rename area gets a test pass before/after:

1. **Type tests** (`*.test-d.ts`) — assert that `createEmailRpc<Ctx>()` returns a builder whose `.catalog({...})` produces an `EmailCatalog`, that nested composition produces the expected nested call surface, that context mismatch fails to compile, and that the kind brand discriminates email vs catalog at the value level.
2. **Runtime tests** — port existing `router.test.ts` cases to `catalog.test.ts`, plus new cases for nested composition (two-level and three-level), dot-path ID resolution in the logger child binding, and worker job-name derivation.
3. **Example smoke** — every example under `examples/**` must build, typecheck, and (where runnable) execute against the mock transport. `pnpm --filter @example/welcome-text-cli build` and `pnpm --filter @example/welcome-text-cli typecheck` are blocking. At least one example is rewritten to use a nested catalog so the new composition path is exercised end-to-end in a realistic call site.
4. **Full sweep** — `pnpm ci` must pass clean.

## Migration notes for downstream

For users of v0.1.0-alpha:

```ts
// Before
import { emailRpc, createClient } from '@emailrpc/core';
const t = emailRpc.init<Ctx>();
const router = t.router({ welcome });
const mail = createClient({ router, transport });

// After
import { createEmailRpc, createClient } from '@emailrpc/core';
const rpc = createEmailRpc<Ctx>();
const catalog = rpc.catalog({ welcome });
const mail = createClient({ catalog, transport });
```

Renames at a glance:

- `emailRpc.init<Ctx>()` → `createEmailRpc<Ctx>()`
- `t.router({...})` → `rpc.catalog({...})`
- `createClient({ router })` → `createClient({ catalog })`
- `createWorker({ router })` → `createWorker({ catalog })`
- Type `EmailRouter<...>` → `EmailCatalog<...>`

`createWebhookRouter` is unchanged.

A changeset will mark this as a major-bump-equivalent breaking change. Since the package is on `0.x`, the next release bumps the minor.

## Open questions

None at spec-write time. All decisions were made during brainstorming:

- Catalog framing chosen over contract / manifest / spec / domain metaphors.
- `createEmailRpc` chosen over `defineMail` / `createMail` for parallel with `createClient`/`createTransport`/`createWorker`.
- `rpc` chosen as the conventional variable name (vs `t`).
- Namespaced (nested) merge chosen over flat merge.
- Unified `.catalog({...})` chosen over a separate `.merge()` method.
- `createWebhookRouter` left unchanged.
