# Hooks, Middleware & Plugins — Design

**Date:** 2026-04-25
**Status:** Draft, ready for review
**Scope:** `@emailrpc/core` Layers 4 + adjacent client surface
**Companion spec:** `plan/emailrpc-spec.md` §8 (Middleware), §9 (Hooks)

---

## 1. Goals

- Close the gap between `plan/emailrpc-spec.md` §8/§9 and the current `@emailrpc/core` implementation, where:
  - Hooks support only three of the four phases, only one handler per kind, with `input: unknown`.
  - Every middleware in `middleware.ts` is a stub that throws.
  - The `.use()` builder method does not exist.
  - There is no plugin concept.
- Land a coherent, type-safe behavior layer that can host the deferred work (suppression list, rate limit, OpenTelemetry, queue) without further reshaping.
- Stay focused: this push touches Layer 4 and the parts of Layers 1–2 that connect to it. No queue, no providers, no template adapters.

## 2. Non-goals

- Queue, worker, `mail.<route>.queue(...)`, `onEnqueue` / `onDequeue`, `via` / `attempt` hook fields.
- Stateful middleware (`suppressionListMw`, `rateLimitMw`, `idempotencyMw`) — they need a `Store` interface that deserves its own design.
- OpenTelemetry plugin — needs peer-dep choices.
- Real providers (`smtp`, `ses`, `resend`) and template adapters (React Email, MJML, Handlebars) — separate cycle (part D in the implementation plan).
- Plugin-contributed client methods (e.g. plugin adds `.queue()` to the client). Decided when the queue cycle lands.
- Per-call hooks (`mail.welcome.send(args, { onSuccess })`). The promise return value already serves that purpose; cross-cutting concerns require ambient hooks.

## 3. Surface overview

Three places where behavior attaches:

```ts
const t = emailRpc.init<Ctx>()

const audited = t.use(auditLogMw())                             // sub-builder with mw baked in
const passwordReset = audited.email().input(...).template(...)  // inherits auditLogMw
const welcome = t.email().input(...).template(...)              // no auditLog

const emails = t.router({ welcome, passwordReset })

const mail = createClient({
  router: emails,
  providers: [{ name: 'smtp', provider: smtp(...), priority: 1 }],
  hooks: {
    onAfterSend: ({ route, input, result }) => metrics.track('email.sent', { route }),
  },
  plugins: [loggerPlugin()],
})
```

Mental model:

| Piece | Role | Contains |
|---|---|---|
| Router | Contract — what emails exist | route id, schema, subject, template, **per-route middleware** |
| Client | Runtime — how to send them in this environment | provider, hooks, plugins, defaults |

**Builder middleware** (`t.use(...)`) is contract-bound. It travels with the route definition; tests, workers, and CLI all see the same middleware. Suitable for audit logs, rate limiting, suppression checks, idempotency.

**Client hooks** (`createClient({ hooks })`) are deployment-bound observation. Different per environment. Suitable for metrics, structured logging, alerting, analytics. Cannot mutate the pipeline.

**Client plugins** (`createClient({ plugins })`) are deployment-bound bundles with lifecycle. Suitable for OpenTelemetry, suppression-store wiring, anything that needs setup at startup and teardown at shutdown.

## 4. Builder middleware

### 4.1 Shape

```ts
type MiddlewareParams<TInput, TCtxIn, TCtxOut> = {
  input: TInput
  ctx: TCtxIn
  route: string
  next: (newCtx?: Partial<TCtxOut>) => Promise<SendResult>
}

type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut>,
) => Promise<SendResult>
```

`TInput` is the procedure's parsed input type. `TCtxIn` is the ctx as seen by this middleware; `TCtxOut` is the ctx after this middleware mutates it (defaults to no change). When a generic middleware (e.g. `loggerMw`) attaches to any route, `TInput` is `unknown`.

### 4.2 Attachment

Two equivalent forms.

Inline on the builder:

```ts
const passwordReset = t
  .use(rateLimitMw({ key: 'recipient', max: 3, window: '1h' }))
  .use(auditLogMw())
  .email()
  .input(...)
  .template(...)
```

Sub-builder (oRPC pattern), reused across routes:

```ts
const audited = t.use(auditLogMw())
const passwordReset  = audited.email().input(...).template(...)
const accountDeletion = audited.email().input(...).template(...)
```

`.use()` returns a new builder with the middleware appended and `Ctx` widened by `TCtxOut`. Procedures built from the new builder carry that middleware list and the new ctx type.

### 4.3 Behavior

- **Mutate ctx.** `return next({ tenantId })` shallow-merges into ctx for downstream middleware and for hooks that fire after this middleware runs.
- **Short-circuit.** Don't call `next()`, return a synthetic `SendResult` directly. The pipeline treats it as a successful send.
- **Wrap.** `await next()`, then post-process. Standard onion.

### 4.4 Order

Middleware runs in the order `.use()` was called. First `.use()` is outermost.

```
.use(A).use(B).use(C):

A enter
  B enter
    C enter
      render
      provider.send
    C unwind
  B unwind
A unwind
```

Plugin middleware (§6.3) sits outside all of this — wrapping every route's chain.

### 4.5 Type guarantee

A middleware whose `TInput` requires `{ recipient: string }` can only attach to a builder whose schema satisfies that constraint. Type errors at `.use()` time when input shape doesn't match. This matches the `.template()` constraint already in `EmailBuilder`.

### 4.6 Short-circuit + hooks

If middleware returns without calling `next()`:
- Render does NOT run. `onError(phase: 'render')` does NOT fire.
- `provider.send` does NOT run. `onError(phase: 'send')` does NOT fire.
- `onExecute` does NOT fire (no `RenderedMessage` exists).
- `onAfterSend` DOES fire with the synthetic `SendResult`.

This matches §8.1 of the parent spec — short-circuit is a successful "send" from the pipeline's POV.

### 4.7 Middleware lifecycle diagram

```
mail.welcome.send(args)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ Plugin middleware (outer)                             │
│   pluginA.middleware                                  │
│     pluginB.middleware                                │
│       ┌──────────────────────────────────────────┐    │
│       │ Route middleware (from t.use())          │    │
│       │   routeMw1 (e.g. rateLimit)              │    │
│       │     routeMw2 (e.g. audit)                │    │
│       │       ┌─────────────────────────────┐    │    │
│       │       │ render → onExecute → send   │    │    │
│       │       └─────────────────────────────┘    │    │
│       │     routeMw2 unwind                      │    │
│       │   routeMw1 unwind                        │    │
│       └──────────────────────────────────────────┘    │
│     pluginB unwind                                    │
│   pluginA unwind                                      │
└───────────────────────────────────────────────────────┘
        │
        ▼
   SendResult
```

A short-circuit at any layer collapses the inner layers but unwinds outer layers normally.

## 5. Client hooks

### 5.1 Shape

```ts
type HookFn<T> = (params: T) => void | Promise<void>

type ClientHooks<R extends AnyEmailRouter> = {
  onBeforeSend?: HookFn<BeforeSendCtx<R>> | HookFn<BeforeSendCtx<R>>[]
  onExecute?:    HookFn<ExecuteCtx<R>>    | HookFn<ExecuteCtx<R>>[]
  onAfterSend?:  HookFn<AfterSendCtx<R>>  | HookFn<AfterSendCtx<R>>[]
  onError?:      HookFn<ErrorCtx<R>>      | HookFn<ErrorCtx<R>>[]
}
```

`T | T[]` shape: a single function (the common case) and an array (multi-registration) both work; the implementation normalizes to an array internally.

### 5.2 Hook context — discriminated union over routes

```ts
type RouteUnion<R extends AnyEmailRouter> = {
  [K in keyof R['emails'] & string]: { route: K; input: InputOf<R, K> }
}[keyof R['emails'] & string]

type BeforeSendCtx<R extends AnyEmailRouter> = RouteUnion<R> & {
  args: SendArgs<unknown>
  ctx: unknown
  messageId: string
}

type ExecuteCtx<R extends AnyEmailRouter>   = BeforeSendCtx<R> & { rendered: RenderedMessage }
type AfterSendCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & { result: SendResult; durationMs: number }
type ErrorCtx<R extends AnyEmailRouter>     = BeforeSendCtx<R> & {
  error: EmailRpcError
  phase: 'validate' | 'middleware' | 'render' | 'send' | 'hook'
}
```

User code narrows by `route`:

```ts
hooks: {
  onAfterSend: ({ route, input, result }) => {
    if (route === 'welcome') input.name           // string
    if (route === 'passwordReset') input.token    // string
  },
}
```

`ctx` is typed as `unknown` for now — typing it through plugins/middleware that mutate ctx is tractable but adds enough complexity that it deserves its own pass. Punted to the queue cycle.

`attempt` and `via` fields are intentionally omitted — they only become meaningful with a queue. Adding fields to a hook context is non-breaking, so they can be added when queue lands.

### 5.3 Multi-registration semantics

- Hooks of the same kind run in array order, sequentially, awaited.
- A throw in one hook is caught; the next hook still runs.
- The thrown error is re-emitted via `onError(phase: 'hook')`. Today's implementation only `console.error`s — this upgrade makes hook errors observable through the same channel as everything else.
- Plugin-contributed hooks run **before** user-provided hooks for the same kind. Effective registration order: `[plugin1.hooks, plugin2.hooks, …, user.hooks]`.

### 5.4 Blocking vs. best-effort

| Hook | Awaited? | Affects send result? | On throw |
|---|---|---|---|
| `onBeforeSend` | yes | yes — throwing aborts the send | re-emit via `onError(phase: 'hook')`, then throw to caller |
| `onExecute` | yes | yes — throwing aborts the send | re-emit via `onError(phase: 'hook')`, then throw to caller |
| `onAfterSend` | yes | no — the send already succeeded | re-emit via `onError(phase: 'hook')`, swallowed |
| `onError` | yes | no — the send already failed | log via `console.error`; subsequent `onError` handlers in the array still run; **NOT** re-emitted as `onError(phase: 'hook')` |

The recursion guard: throws from `onError` handlers are the **only** hook throws that don't re-emit through `onError(phase: 'hook')`. Doing so would risk infinite loops if every `onError` handler also throws. The other three phases re-emit normally because their handlers don't run inside an error context already.

## 6. Client plugins

### 6.1 Shape

```ts
type Plugin<R extends AnyEmailRouter = AnyEmailRouter> = {
  name: string
  hooks?: ClientHooks<R>
  middleware?: Middleware[]
  onCreate?: (params: { router: R }) => void | Promise<void>
  onClose?: () => void | Promise<void>
}
```

### 6.2 Lifecycle

```
createClient({ plugins: [A, B, C] })
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ CREATE PHASE — once, in array order                   │
│   A.onCreate({ router })                              │
│   B.onCreate({ router })                              │
│   C.onCreate({ router })                              │
│   (await each; throw aborts createClient)             │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ ACTIVE PHASE — many sends                             │
│   For each mail.<route>.send(...):                    │
│     • Plugin middleware (A → B → C, outer)            │
│     • Route middleware (from t.use())                 │
│     • Render → onExecute → provider.send              │
│     • Hooks fire in order: plugin A, B, C, user       │
└───────────────────────────────────────────────────────┘
        │
        ▼ mail.close()
┌───────────────────────────────────────────────────────┐
│ CLOSE PHASE — once, REVERSE order                     │
│   C.onClose()                                         │
│   B.onClose()                                         │
│   A.onClose()                                         │
└───────────────────────────────────────────────────────┘
```

Lifetime: create → 0..N sends → close. Create is one-shot setup. Close is one-shot teardown. Hooks/middleware run per send.

### 6.3 Composition rules

- Plugins resolve in array order at `createClient` time.
- All plugin `hooks` arrays are flattened and **prepended** to user hooks for each kind.
- All plugin `middleware` arrays are concatenated and **prepended** to every route's middleware chain (so they wrap the route middleware).
- `onCreate` runs awaited at `createClient` call time; an error aborts `createClient`.
- `onClose` runs in **reverse** plugin order on `mail.close()`.
- `mail.close()` is a new method on the `EmailClient` type.

### 6.4 Example — observability plugin

```ts
const loggerPlugin = (opts?: { logger?: Logger }): Plugin => {
  const log = opts?.logger ?? console
  return {
    name: 'logger',
    hooks: {
      onBeforeSend: ({ route, messageId }) => log.info(`[email] start ${route} ${messageId}`),
      onAfterSend: ({ route, messageId, durationMs }) => log.info(`[email] done ${route} ${messageId} ${durationMs}ms`),
      onError: ({ route, messageId, phase, error }) => log.error(`[email] fail ${route} ${messageId} phase=${phase} ${error.message}`),
    },
  }
}
```

## 7. Full execution order

```
mail.welcome.send(args)

 1. validate(args.input)                      → throw → onError(phase: 'validate')
 2. messageId = ulid()
 3. ctx0 = clientCtxFactory?.() ?? {}

 4. fire onBeforeSend (plugin order, then user)
                                              → throw → onError(phase: 'hook')
                                                        then re-throw to caller

 5. enter middleware chain (onion):
       plugin1.mw → … → routeMw1 → routeMw2 → …
                                              → throw → onError(phase: 'middleware')
                                                        then re-throw

 6.   render template                         → throw → onError(phase: 'render')
                                                        then re-throw
 7.   fire onExecute (plugin order, then user)
                                              → throw → onError(phase: 'hook')
                                                        then re-throw
 8.   provider.send(rendered, sendCtx)        → throw → onError(phase: 'send')
                                                        then re-throw

 9. unwind middleware (post-next code, reverse order)

10. fire onAfterSend (plugin order, then user)
                                              → throw → onError(phase: 'hook')
                                                        swallowed

11. return SendResult
```

Short-circuit: if a middleware returns a synthetic `SendResult` without calling `next()`, steps 6/7/8 are skipped; outer middleware unwinds normally; step 10 runs with the synthetic result.

## 8. What ships in this push

### 8.1 Core changes (`@emailrpc/core`)

1. **`EmailBuilder.use(mw)`** — appends middleware to the builder's middleware list, widens `Ctx` if the middleware specifies `TCtxOut`. Returns a new builder.
2. **Builder state** — extend `InternalBuilderState` with `middleware: Middleware[]`. `EmailDefinition` carries `middleware: Middleware[]`.
3. **`client.ts` rewrite (`executeSend`)** — onion executor that runs plugin middleware then route middleware, then render → `onExecute` → `provider.send`. Replace today's three flat hook calls with the four-phase, multi-handler system.
4. **`createClient`** — accepts `hooks` (multi-registration), `plugins`. Resolves plugin `onCreate` synchronously-or-await. Returns an `EmailClient` with a new `close()` method.
5. **`mail.close()`** — runs plugin `onClose` in reverse order.
6. **Hook context types** — `BeforeSendCtx<R>`, `ExecuteCtx<R>`, `AfterSendCtx<R>`, `ErrorCtx<R>` — discriminated unions over `RouteUnion<R>`.
7. **Built-in middleware (trivial three)** — replace stubs with real implementations:
   - `loggerMw({ logger? })` — log start/end with route + messageId + duration.
   - `dryRunMw()` — short-circuits with synthetic `SendResult`.
   - `tagInjectMw({ tags })` — adds headers to `args.headers` via `next()` ctx mutation or by mutating `args` (TBD in plan).
8. **Built-in plugin (one)** — `loggerPlugin({ logger? })` — same observability via plugin shape; demonstrates the surface with no infra.
9. **Errors** — extend `EmailRpcError` `phase` codes with `'middleware'` and `'hook'`. Existing `EmailRpcValidationError` unchanged.

### 8.2 Tests (collocated, vitest)

- `middleware.test.ts` — onion order, ctx mutation propagation, short-circuit returns synthetic `SendResult`, type checks via `.test-d.ts`.
- `client.test.ts` — full hook ordering against §7 lifecycle, multi-hook registration, hook-error re-emission via `onError(phase: 'hook')`, plugin install/close, plugin hooks running before user hooks, `mail.close()` runs plugins in reverse.
- `builder.test.ts` — `.use()` returns a new builder; sub-builder pattern; middleware list propagates through subsequent `.use()` calls and into `EmailDefinition`.
- `plugins.test.ts` — `onCreate` failure aborts `createClient`; `onClose` reverse order; middleware composition prepends plugin middleware before route middleware.

### 8.3 Out of scope (and how the design accommodates them later)

| Item | How this design leaves room |
|---|---|
| `suppressionListMw`, `rateLimitMw`, `idempotencyMw` | They land as ordinary middleware against the same `Middleware` type — no shape changes. They need a `Store` interface, designed separately. |
| OTel plugin | Lands as an ordinary `Plugin` using `onCreate` (register tracer) + `onClose` (flush + shutdown) + `hooks`. No core changes. |
| Queue + worker + `mail.<route>.queue(...)` | Queue ships as an adapter package. Open question: whether it contributes a `.queue()` method via plugin augmentation or stays a separate exported function. Decided in the queue cycle. Until then, the deferred `EmailJob` wire-format type stays in `queue.ts` as it is. |
| `via` / `attempt` hook fields, `onEnqueue` / `onDequeue` | Added when queue lands. Adding fields to existing hook contexts is non-breaking. |
| `ctx` typing through middleware mutation chain | Today it surfaces as `unknown` to hooks. Threading a generic through the chain is doable but adds complexity; deferred. |
| Plugin-contributed client methods | `Plugin` type stays minimal. When queue cycle decides on the augmentation pattern, the type gets an optional `extendsClient` field. Backwards compatible. |

## 9. Migration from current code

- `client.ts` `executeSend` — replaced. The current single-handler `hooks: { onBeforeSend?, onAfterSend?, onError? }` becomes `T | T[]` and gains `onExecute`. Single-fn form still works at the call site.
- `client.test.ts` hook tests — current shape continues to type-check (single-fn). New tests added for multi-registration, `onExecute`, `phase: 'hook'` re-emission.
- `middleware.ts` — `loggerMw`, `dryRunMw`, `tagInjectMw` become real. The other stubs stay throwing `EmailRpcNotImplementedError` with TODO comments pointing at the followup design.
- `init.ts` — `InitHooks<Ctx>` is removed; `InitOptions<Ctx>` stays for forward compatibility but currently empty. `emailRpc.init()` and `emailRpc.init({})` both work; passing `{ hooks: ... }` becomes a type error with a helpful message ("hooks moved to createClient").
- No queue work; `sender.ts` `createSender` deprecation stub stays as-is.

## 10. Open questions

- `tagInjectMw` — does it mutate `args.headers` directly (then how does the middleware see them), or merge via a ctx field that the renderer/sender reads at compose time? Resolved during implementation; doesn't affect external API.
- Should `mail.close()` reject in-flight sends or wait for them to drain? Lean: wait, with no timeout in v0.1; add timeout option later.
- Naming: `Middleware` vs `RouteMiddleware`? Lean: `Middleware` (single concept, attachment site is the differentiator).

## 11. Acceptance criteria

- All tests in §8.2 pass.
- The execution order in §7 is observable and locked by tests against a recording plugin.
- The current minimum example (`examples/welcome-text`) still type-checks and runs (today it doesn't actually send; the test continues to use `mockProvider`).
- `pnpm ci` green from the repo root.
