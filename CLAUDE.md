# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

emailRpc is an end-to-end typed email infrastructure for Node.js (ESM-only, Node ≥ 22). A single `EmailRouter` type drives the typed sender, queue worker, and webhook router — analogous to tRPC/oRPC, but for email. The full design contract lives in `plan/emailrpc-spec.md`; treat it as the source of truth when behavior is ambiguous.

Status: v0.1.0-alpha. Layer 1 (typed contracts in `@emailrpc/core`) plus build/release tooling are real. Adapter packages (`react-email`, `mjml`, `handlebars`, `ses`, `resend`, `bullmq`) and Layers 5–6 are stubs filled in over the v0.2+ roadmap.

## Commands

Run from the repo root unless noted. Turbo handles the workspace dependency graph (`dependsOn: ["^build"]`) and caching.

```sh
pnpm install
pnpm build           # turbo run build (rolldown per package)
pnpm typecheck       # tsc --noEmit per package
pnpm test            # vitest run (root config; collocated *.test.ts under packages/*/src)
pnpm lint            # oxlint --fix per package
pnpm fmt             # oxfmt
pnpm ci              # build + typecheck + test + lint
pnpm changeset       # add a changeset for any user-facing change
```

Per-package work:

```sh
pnpm --filter @emailrpc/core test
pnpm --filter @emailrpc/core test:watch
pnpm --filter @emailrpc/core build
pnpm --filter @emailrpc/core exec vitest run src/client.test.ts          # single file
pnpm --filter @emailrpc/core exec vitest run -t "createClient"           # by test name
```

Vitest is configured at the **repo root** (`vitest.config.ts`) and discovers `packages/*/src/**/*.test.ts` plus `*.test-d.ts` typecheck files. Each package also has its own `vitest.config.ts` so package-level `vitest run` works under turbo.

Requires Node ≥ 22 and pnpm 10. Node version pinned via `.nvmrc`.

## Architecture

Six conceptual layers, each consuming the layer above through types (see spec §2):

1. **Contracts** (`@emailrpc/core`) — `emailRpc.init<Ctx>()` returns a builder `t`; `.email(id).input(schema).subject(...).template(adapter)` defines a route; `t.router({...})` aggregates routes. The exported `typeof router` is the contract every other layer derives from.
2. **Sender** (`@emailrpc/core/sender`) — `createSender<EmailRouter>({ router, provider, queue?, defaults })` exposes `mail.<route>(input)`, `mail.<route>.queue(input, opts)`, `mail.<route>.render(input)` for each route.
3. **Provider** (`@emailrpc/core/provider` + `@emailrpc/{ses,resend}`) — `Provider` interface with `send(message, ctx)`. Built-ins: `smtp`, `multi`, `mock`. Heavy peers split into separate packages.
4. **Middleware + Hooks** — middleware (`.use()`) can mutate context / short-circuit; hooks (`onBeforeSend` / `onExecute` / `onAfterSend` / `onError` / `onEnqueue` / `onDequeue`) only observe. **Rule of thumb: if removing it would change whether the email goes out, it must be middleware, not a hook.**
5. **Queue + worker** (`@emailrpc/core/worker` + `@emailrpc/bullmq`) — workers re-validate jobs on pickup; mismatched schemas DLQ.
6. **Webhook router** (`@emailrpc/core/webhook`) — `t.webhookRouter({...})` with provider adapters for signature verification.

Validation runs through **Standard Schema** (Zod 3.24+, Valibot, ArkType), so `@emailrpc/core` has zero hard validator dependency.

Templates: `TemplateAdapter<TInput>` is a single `render(input) => Promise<{ html, text?, subject? }>`. Core never renders HTML itself — adapters do (React Email, MJML, Handlebars, or hand-rolled). The `.template()` builder type-constrains the adapter to the procedure's `TInput`, so schema and template cannot silently drift.

Errors all subclass `EmailRpcError` and are JSON-serializable for queue persistence (see spec §14).

## Monorepo layout

- `packages/core` — published as `@emailrpc/core`. Subpath exports under `./sender`, `./worker`, `./webhook`, `./provider`, `./template`, `./queue`, `./middleware`, `./test`, `./config`. Source in `src/` (tests collocated as `*.test.ts`).
- `packages/{react-email,mjml,handlebars,ses,resend,bullmq}` — published adapters; each pulls a single non-trivial peer.
- `internal/{tsconfig,rolldown-config,fixtures}` — `private: true`, never published, consumed via `workspace:*`.
- `examples/*` — sample apps; ignored by changesets.

Adapter split rule (spec §3.2): **a feature ships as its own package only if it pulls a non-trivial peer dependency.** Otherwise it lives in `core` under a subpath export. Don't create new packages for thin wrappers.

## Build

Rolldown bundles each package via the shared `internal/rolldown-config/base.ts`. Output is **ESM-only** at this stage (`dist/*.js` + bundled `*.d.ts` via `rolldown-plugin-dts`); CJS returns at v1.0 once the public API is frozen. The base config externalizes `node:*`, `@emailrpc/*`, and `@standard-schema/*` so workspace siblings are never inlined.

`@internal/rolldown-config` and `@internal/tsconfig` are consumed via `workspace:*` — extend their presets in new packages rather than duplicating config.

## Conventions

- **No code comments.** Don't write JSDoc, inline notes, or "what this does" headers; identifiers and types should carry the meaning. (User global rule.)
- **Prefer `type` over `interface`.** (User global rule — applies even though some upstream code in the spec shows `interface`.)
- **Prefer `handlePromise` over try/catch** for async error handling. (User global rule.) `handlePromise` is the project's tuple-returning async wrapper — use it when introducing new async flows.
- **Don't commit unless asked.** (User global rule.)
- Tests are **collocated** under `packages/*/src/**/*.test.ts` (root `vitest.config.ts` enforces this — top-level `test/` directories are deprecated and being removed).
- Linter is **oxlint** + formatter is **oxfmt** (not ESLint/Prettier). `import/no-cycle` is enforced as `error`.
- Changesets: every user-facing change needs a changeset. Internal packages (`@internal/*`, `@example/*`) are ignored.

## Reference docs

- `plan/emailrpc-spec.md` — full technical spec; the contract for every layer's behavior.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design notes and execution plans for in-progress work (e.g. `2026-04-25-create-client-design.md`).
- `README.md` — short public-facing summary and package status table.
