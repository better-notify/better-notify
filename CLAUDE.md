# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

emailRpc is an end-to-end typed email infrastructure for Node.js (ESM-only, Node ≥ 22). A single `EmailCatalog` type drives the typed sender, queue worker, and webhook router — analogous to tRPC/oRPC, but for email. The full design contract lives in `plan/emailrpc-spec.md`; treat it as the source of truth when behavior is ambiguous.

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

1. **Contracts** (`@emailrpc/core`) — `createEmailRpc<Ctx>()` returns a builder `rpc`; `rpc.email().input(schema).subject(...).template(adapter)` defines a procedure; `rpc.catalog({...})` aggregates procedures (and other catalogs) into a typed contract. Sub-catalogs flatten into dot-path IDs (`transactional.welcome`). The exported `typeof catalog` is the contract every other layer derives from.
2. **Sender** (`@emailrpc/core/sender`) — `createSender<EmailCatalog>({ catalog, provider, queue?, defaults })` exposes `mail.<route>(input)`, `mail.<route>.queue(input, opts)`, `mail.<route>.render(input)` for each route.
3. **Transport** (`@emailrpc/core/transports` + `@emailrpc/{smtp,ses,resend}`) — `Transport` type with `send(message, ctx)`. Built-ins: `mockTransport`, `multiTransport`. Heavy peers split into separate packages (`smtpTransport` lives in `@emailrpc/smtp`).
4. **Middleware + Hooks** — middleware (`.use()`) can mutate context / short-circuit; hooks (`onBeforeSend` / `onExecute` / `onAfterSend` / `onError` / `onEnqueue` / `onDequeue`) only observe. **Rule of thumb: if removing it would change whether the email goes out, it must be middleware, not a hook.**
5. **Queue + worker** (`@emailrpc/core/worker` + `@emailrpc/bullmq`) — workers re-validate jobs on pickup; mismatched schemas DLQ.
6. **Webhook router** (`@emailrpc/core/webhook`) — `rpc.webhookRouter({...})` with provider adapters for signature verification.

Validation runs through **Standard Schema** (Zod 3.24+, Valibot, ArkType), so `@emailrpc/core` has zero hard validator dependency.

Templates: `TemplateAdapter<TInput>` is a single `render(input) => Promise<{ html, text?, subject? }>`. Core never renders HTML itself — adapters do (React Email, MJML, Handlebars, or hand-rolled). The `.template()` builder type-constrains the adapter to the procedure's `TInput`, so schema and template cannot silently drift.

Errors all subclass `EmailRpcError` and are JSON-serializable for queue persistence (see spec §14).

## Monorepo layout

- `packages/core` — published as `@emailrpc/core`. Subpath exports under `./sender`, `./worker`, `./webhook`, `./transports`, `./template`, `./queue`, `./middlewares`, `./plugins`, `./config`. Source in `src/` (tests collocated as `*.test.ts`).
- `packages/{react-email,mjml,handlebars,smtp,ses,resend,bullmq}` — published adapters; each pulls a single non-trivial peer.
- `internal/{tsconfig,rolldown-config,fixtures}` — `private: true`, never published, consumed via `workspace:*`.
- `examples/*` — sample apps; ignored by changesets.

Adapter split rule (spec §3.2): **a feature ships as its own package only if it pulls a non-trivial peer dependency.** Otherwise it lives in `core` under a subpath export. Don't create new packages for thin wrappers.

## Bootstrapping new packages and examples

Use the turbo generators in `turbo/generators/config.ts` — do not hand-author scaffolds:

```sh
pnpm gen        # interactive picker
# or:
pnpm exec turbo gen run package   # new @emailrpc/* package under packages/
pnpm exec turbo gen run example   # new example under examples/ (apps/cli + packages/emails)
```

Run `pnpm install` after generating so workspace links resolve.

Examples follow a non-recursive turbo pattern: the example root's `start`/`dev` scripts invoke `turbo run <task> --filter=@<name>/cli`, **never** plain `turbo run start` (that recurses because turbo matches the example root itself). The `start` and `dev` tasks are declared in the **root** `turbo.json` (`dependsOn: ["^build"]`, `cache: false`; `dev` is `persistent: true` and uses `tsx --watch`) — nested example `turbo.json` files are not needed. The root `package.json` has a `dev` script wired to the canonical demo example so `pnpm dev` from the repo root just works.

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
- **Middleware naming**: middleware factories use the `withName` pattern (e.g. `withDryRun`, `withTagInject`). They live in `packages/core/src/middlewares/<withName>.ts`. Per-middleware option types (e.g. `WithTagInjectOptions`) live in `<withName>.types.ts` only when the middleware has its own options; the shared `Middleware`/`AnyMiddleware`/`MiddlewareParams` types live in `middlewares/types.ts`. The barrel `middlewares/index.ts` re-exports everything.
- **Plugin organization**: each plugin lives in `packages/core/src/plugins/<pluginName>.ts` with per-plugin types in `<pluginName>.types.ts` when applicable; the shared `Plugin` type lives in `plugins/types.ts`; barrel re-exports through `plugins/index.ts`.
- **Transport organization**: each transport implementation lives in `packages/core/src/transports/<name>.ts` (or in its own package like `@emailrpc/smtp`, `@emailrpc/ses` for transports that pull non-trivial peers). Per-transport option types live in `<name>.types.ts` when applicable; the shared `Transport`/`TransportResult`/`TransportEntry` types live in `transports/types.ts`. Barrel re-exports through `transports/index.ts`. The `Transport` type is the wire-level email send adapter (SMTP, SES, Resend) — distinct from `Sender` at Layer 2.
- **Lint rules** (in `.oxlintrc.json`): `typescript/no-non-null-assertion`, `no-console`, and `no-else-return` (with `allowElseIf: false`) are all `error`. Overrides: tests allow `!` and `console`; `packages/core/src/logger.ts` allows `console` (it IS the console adapter); `examples/**/*.ts` allow both. Replace `!` with proper narrowing — cache `handlePromise` tuples and access by index instead of destructuring (TS narrows `tuple[1]` discriminated unions correctly); guard array index loops with `if (!x) continue`; cache nullable refs in const before use inside closures.

## Architectural decisions

- **Logger is built into core**, not opt-in. `createClient`/`createWorker`/`createWebhookRouter` accept `logger?: LoggerLike`; defaults to `consoleLogger({ level: 'warn' })` (silent on success, errors visible). BYO via the structural `LoggerLike` type — no hard pino dep, mirroring the Standard Schema philosophy. Pino interop via `fromPino()`. Per-send child binds `{ component, route, messageId }`. **Errors always go under the `err` key** (pino's `stdSerializers.err` requires it; spreading `{ error }` makes pino render `{}`).
- **Address shape**: `Address = string | { name?: string; email: string }`. Field is `email`, not `address` — RFC 5322 calls them "addresses" but in user-land builder code `email` reads naturally and avoids confusion with the wider word.
- **`.from()` and `defaults.from`** both accept `FromInput = string | { name?: string; email?: string }` (both fields optional). They shallow-merge per-field at send time via `resolveFrom()` in `client.ts` — per-email overrides, defaults fill in gaps. Transports always receive a complete `Address` with `email` resolved.
- **Transport contract is dumb**: transports receive a fully-resolved `RenderedMessage` and just deliver it. No re-validation, no re-rendering, no re-resolving addresses — that's the pipeline's job upstream. Use `formatAddress` / `normalizeAddress` from `@emailrpc/core/transports` instead of duplicating address-handling code in adapter packages.
- **No abstract classes for shared transport behavior** — use shared utility functions exported from `@emailrpc/core/transports`. Inheritance breaks across bundle boundaries (`instanceof` fails on duplicate-package situations) and forces consumers into class syntax. Functional composition stays structural and tree-shakeable.
- **JSDoc only on public-API surface** (exported types, factory functions). The "no comments" rule still applies to function bodies. Document the contract for downstream implementers, not the implementation.
- **`./test` subpath was removed**: `mockTransport` is now part of the public `transports` surface (it's a useful dev tool, not just a test helper). The remaining test utilities (`memoryLogger`, `recordHooks`) stay in `packages/core/src/test.ts` as **internal-only** — used by core's own tests, not built into `dist`, not exported via subpath.

## Reference docs

- `plan/emailrpc-spec.md` — full technical spec; the contract for every layer's behavior.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design notes and execution plans for in-progress work (e.g. `2026-04-25-create-client-design.md`).
- `README.md` — short public-facing summary and package status table.
