# createClient — Typed Email Client Design

> Proxy-based, fully typed email client that infers route inputs from the router and orchestrates the send pipeline through registered providers.

**Date:** 2026-04-25
**Scope:** Layer 2 — `createClient`, provider selection, send pipeline, render, client-level hooks
**Out of scope:** `.enqueue()` (queue integration), `$send()` dynamic dispatch, `interface → type` migration of existing code, plain-text fallback via `html-to-text`

---

## 1. Problem

The current Layer 1 ships contracts (router, builder, schema validation, template adapters) but has no typed way to actually send an email. The example code manually extracts definitions, validates, resolves subjects, and renders — all inline:

```ts
async function send<K extends keyof typeof emails.emails>(route: K, rawInput: unknown) {
  const def = emails.emails[route];
  const input = await validate(def.schema, rawInput, { route });
  const subject = typeof def.subject === 'function' ? def.subject({ input }) : def.subject;
  const rendered = await def.template.render(input);
  return {
    from: def.from,
    to: (input as { to: string }).to,
    subject,
    text: rendered.text ?? '',
    html: rendered.html,
  };
}
```

This is hacky: no type inference on input, manual pipeline orchestration, `as` casts, no provider integration. The SDK should handle all of this.

---

## 2. Design

### 2.1 `createClient` — entry point

```ts
import { createClient } from '@emailrpc/core'
import { ses } from '@emailrpc/ses'
import { smtp } from '@emailrpc/core/provider'
import { mockProvider } from '@emailrpc/core/test'
import { emails } from './emails'

const mail = createClient({
  router: emails,
  providers: [
    { name: 'ses', provider: ses({...}), priority: 1 },
    { name: 'smtp', provider: smtp({...}), priority: 2 },
  ],
  defaults: {
    from: 'hello@guidemi.com',
    replyTo: 'support@guidemi.com',
  },
  hooks: {
    onBeforeSend: ({ route, input, messageId }) => {
      logger.info('email.before', { route, messageId })
    },
    onAfterSend: ({ route, result, durationMs }) => {
      metrics.histogram('email.send.duration', durationMs, { route })
    },
    onError: ({ route, error }) => {
      logger.error('email.failed', { route, code: error.code })
    },
  },
})
```

`createClient` returns a Proxy-based object where each property corresponds to a route in the router, exposing `{ send, render }` methods with fully typed inputs.

### 2.2 Route methods

```ts
// .send() — full pipeline: validate → render → send via provider
await mail.welcome.send(
  { to: 'lucas@x.com', name: 'Lucas', verifyUrl: 'https://...' },
)

// .send() with explicit provider override
await mail.welcome.send(
  { to: 'lucas@x.com', name: 'Lucas', verifyUrl: 'https://...' },
  { provider: 'smtp' },  // autocompletes from registered provider names
)

// .render() — validate + render only, no send
const output = await mail.welcome.render(
  { to: 'lucas@x.com', name: 'Lucas', verifyUrl: 'https://...' },
)
// output: { html: string, text?: string }

// .render() with format — returns plain string
const html = await mail.welcome.render(
  { to: 'lucas@x.com', name: 'Lucas', verifyUrl: 'https://...' },
  { format: 'html' },
)
// html: string
```

### 2.3 Provider selection

Providers are registered with a `name` (string literal) and `priority` (number, lower = higher priority).

**Selection logic:**
1. If `.send()` receives `{ provider: 'name' }`, use that provider. Throw `EmailRpcError` with code `PROVIDER` if the name doesn't match any registered provider.
2. Otherwise, use the provider with the lowest `priority` number.

**No automatic failover.** Priority is purely for default selection. If a provider fails, the error surfaces. For failover/retry, wrap providers with `multi()` (spec §7.2), which is itself a `Provider`:

```ts
const resilient = multi({
  strategy: 'failover',
  providers: [
    { provider: ses({...}), weight: 1 },
    { provider: smtp({...}), weight: 1 },
  ],
  isRetriable: (err) => err.code === 'ETIMEDOUT',
})

const mail = createClient({
  router: emails,
  providers: [
    { name: 'primary', provider: resilient, priority: 1 },
    { name: 'marketing', provider: sendgrid({...}), priority: 2 },
  ],
})
```

`multi()` handles resilience. Client providers handle routing.

---

## 3. Types

### 3.1 Provider configuration

```ts
type ProviderEntry = {
  name: string
  provider: Provider
  priority: number
}
```

### 3.2 Client options

```ts
type CreateClientOptions<
  R extends AnyEmailRouter,
  const P extends readonly ProviderEntry[],
> = {
  router: R
  providers: P
  defaults?: {
    from?: Address
    replyTo?: Address
    headers?: Record<string, string>
  }
  hooks?: ClientHooks
}
```

The `const P` generic captures the literal types of provider names so they flow into `SendOptions`.

### 3.3 Client hooks

```ts
type ClientHooks = {
  onBeforeSend?: (params: {
    route: string
    input: unknown
    messageId: string
  }) => void | Promise<void>

  onAfterSend?: (params: {
    route: string
    result: SendResult
    durationMs: number
    messageId: string
  }) => void | Promise<void>

  onError?: (params: {
    route: string
    error: EmailRpcError
    phase: 'validate' | 'render' | 'send'
    messageId: string
  }) => void | Promise<void>
}
```

Client hooks are **observational only** — they return `void`, cannot short-circuit the pipeline, and errors thrown inside hooks are caught and logged (best-effort, matching the spec §9.1 semantics). They run **after** router-level hooks of the same kind.

> **Note:** Contract-level hooks (`.onBeforeSend()` / `.onAfterSend()` / `.onError()` on `EmailBuilder`) are deferred to a later iteration. `EmailBuilder` does not currently expose these methods.

### 3.4 Send options

```ts
type SendOptions<P extends readonly ProviderEntry[]> = {
  provider?: P[number]['name']
}
```

This makes the `provider` field autocomplete from the registered provider names. If `providers` is `[{ name: 'ses', ... }, { name: 'smtp', ... }]`, then `provider` is `'ses' | 'smtp'`.

### 3.5 Render overloads

```ts
// No format → full output
render(input: TInput): Promise<RenderedOutput>

// With format → plain string
render(input: TInput, opts: { format: 'html' | 'text' }): Promise<string>
```

Where `RenderedOutput` is the existing type from `template.ts`: `{ html: string, text?: string, subject?: string }`.

When `format: 'text'` is requested and the adapter didn't return `text`, `render()` returns an empty string (not undefined). The plain-text fallback via `html-to-text` is out of scope for this iteration.

### 3.6 The `EmailClient` type

```ts
type RouteMethods<TInput, P extends readonly ProviderEntry[]> = {
  send(input: TInput, opts?: SendOptions<P>): Promise<SendResult>
  render(input: TInput): Promise<RenderedOutput>
  render(input: TInput, opts: { format: 'html' | 'text' }): Promise<string>
}

type EmailClient<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> = {
  [K in keyof R['emails']]: RouteMethods<InputOf<R, K>, P>
}
```

### 3.7 `createClient` signature

```ts
function createClient<
  R extends AnyEmailRouter,
  const P extends readonly ProviderEntry[],
>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P>
```

---

## 4. Send pipeline

The `send()` method orchestrates the full lifecycle. Steps in order:

```
 1. Generate messageId (crypto.randomUUID)
 2. Validate input against the route's schema
    → on error: fire onError(phase: 'validate'), throw EmailRpcValidationError
 3. Fire router-level onBeforeSend hooks (in registration order)
 4. Fire client-level onBeforeSend hook
 5. Render template via adapter → { html, text?, subject? }
    → on error: fire onError(phase: 'render'), throw EmailRpcError(code: 'RENDER')
 6. Resolve subject:
    - if adapter returned subject → use it (override)
    - else if def.subject is function → call with { input }
    - else use def.subject string
 7. Assemble RenderedMessage:
    - from: contract.from ?? defaults.from (if neither is set, throw EmailRpcError with code 'VALIDATION')
    - to: extracted from validated input (if missing, throw EmailRpcError with code 'VALIDATION')
    - subject: resolved from step 6
    - html, text from rendered output
    - headers: defaults.headers merged with contract tags as X-EmailRpc-Tag-*
 8. Select provider:
    - if opts.provider specified → find by name, throw if not found
    - else → pick provider with lowest priority number
 9. provider.send(renderedMessage, sendContext) → ProviderResult
    → on error: fire onError(phase: 'send'), throw EmailRpcError(code: 'PROVIDER')
10. Build SendResult from ProviderResult + timing
11. Fire router-level onAfterSend hooks
12. Fire client-level onAfterSend hook
13. Return SendResult
```

### 4.1 Hook execution order

Hooks of the same kind run sequentially in this order:

1. **Router-level** — from `emailRpc.init({ hooks })`, applies to all routes
2. **Client-level** — from `createClient({ hooks })`, applies to all sends through this client instance

> Contract-level hooks are deferred to a later iteration (see §9).

Multiple hooks of the same kind at the same level run in registration order.

`onAfterSend` and `onError` hooks are **best-effort**: if a hook throws, subsequent hooks still run, and the error is logged but does not affect the send result or the thrown error.

### 4.2 Error handling

Every error in the pipeline is wrapped in the appropriate `EmailRpcError` subclass (§14 of the spec). The `onError` hook receives the error with a `phase` field indicating where it occurred.

The pipeline does **not** retry on failure. Retries are the responsibility of the queue layer (Layer 5, out of scope) or the `multi()` provider wrapper.

---

## 5. Proxy implementation

`createClient` returns a Proxy. On property access:

1. Check if `key` exists in `router.emails`. If not, return `undefined`.
2. Look up the `EmailDefinition` for that route.
3. Return a frozen object `{ send, render }` where each method closes over:
   - the route's definition (schema, subject, template, from, hooks)
   - the client's providers array
   - the client's defaults and hooks

The Proxy caches the `{ send, render }` object per route key so repeated access (`mail.welcome.send(); mail.welcome.send()`) doesn't create new closures each time.

```ts
function createClient<R extends AnyEmailRouter, const P extends readonly ProviderEntry[]>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P> {
  const { router, providers, defaults, hooks } = options
  const cache = new Map<string, RouteMethods<unknown, P>>()

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority)
  const defaultProvider = sortedProviders[0]
  const providersByName = new Map(providers.map((p) => [p.name, p.provider]))

  return new Proxy({} as EmailClient<R, P>, {
    get(_target, key: string) {
      if (typeof key !== 'string') return undefined

      const def = router.emails[key]
      if (!def) return undefined

      if (cache.has(key)) return cache.get(key)

      const methods = Object.freeze({
        send: (input, opts) => executeSend(def, input, opts, { providers: providersByName, defaultProvider, defaults, hooks, router }),
        render: (input, opts) => executeRender(def, input, opts),
      })

      cache.set(key, methods)
      return methods
    },
  })
}
```

`executeSend` and `executeRender` are internal functions that implement the pipeline from §4.

---

## 6. Usage examples

### 6.1 Basic send

```ts
import { createClient } from '@emailrpc/core'
import { mockProvider } from '@emailrpc/core/test'
import { emails } from './emails'

const mail = createClient({
  router: emails,
  providers: [
    { name: 'mock', provider: mockProvider(), priority: 1 },
  ],
})

const result = await mail.welcome.send({
  to: 'lucas@x.com',
  name: 'Lucas',
  verifyUrl: 'https://example.com/verify/abc',
})
// result: SendResult { messageId, accepted, rejected, envelope, timing }
```

### 6.2 Multiple providers with routing

```ts
const mail = createClient({
  router: emails,
  providers: [
    { name: 'ses', provider: ses({...}), priority: 1 },
    { name: 'smtp', provider: smtp({...}), priority: 2 },
  ],
})

// uses ses (priority 1)
await mail.welcome.send({ to: '...', name: 'Lucas', verifyUrl: '...' })

// explicit override to smtp
await mail.welcome.send(
  { to: '...', name: 'Lucas', verifyUrl: '...' },
  { provider: 'smtp' },
)
```

### 6.3 With failover via multi()

```ts
import { multi } from '@emailrpc/core/provider'

const resilient = multi({
  strategy: 'failover',
  providers: [
    { provider: ses({...}), weight: 1 },
    { provider: smtp({...}), weight: 1 },
  ],
  isRetriable: (err) => err.responseCode >= 500,
})

const mail = createClient({
  router: emails,
  providers: [
    { name: 'primary', provider: resilient, priority: 1 },
  ],
})
```

### 6.4 Render only

```ts
const output = await mail.welcome.render({
  to: 'lucas@x.com',
  name: 'Lucas',
  verifyUrl: 'https://...',
})
// output: { html: '<html>...', text: 'Hi Lucas...' }

const html = await mail.welcome.render(
  { to: 'lucas@x.com', name: 'Lucas', verifyUrl: 'https://...' },
  { format: 'html' },
)
// html: '<html>...'
```

### 6.5 Client hooks for observability

```ts
const mail = createClient({
  router: emails,
  providers: [...],
  hooks: {
    onAfterSend: async ({ route, result, durationMs, messageId }) => {
      await analytics.track('email.sent', { route, messageId, durationMs })
    },
    onError: async ({ route, error, phase }) => {
      await alerting.fire('email-failure', { route, phase, code: error.code })
    },
  },
})
```

---

## 7. Testing

```ts
import { createClient } from '@emailrpc/core'
import { mockProvider } from '@emailrpc/core/test'
import { emails } from './emails'

const provider = mockProvider()
const mail = createClient({
  router: emails,
  providers: [{ name: 'mock', provider, priority: 1 }],
})

await mail.welcome.send({
  to: 'lucas@x.com',
  name: 'Lucas',
  verifyUrl: 'https://example.com/verify',
})

expect(provider.sent).toHaveLength(1)
expect(provider.sent[0]).toMatchObject({
  to: ['lucas@x.com'],
  subject: 'Welcome, Lucas!',
})
```

---

## 8. Files to create/modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/client.ts` | Create | `createClient`, Proxy, pipeline, types |
| `packages/core/src/index.ts` | Modify | Re-export `createClient` |
| `packages/core/src/provider.ts` | Modify | Ensure `Provider` type is compatible (already is) |
| `packages/core/src/test.ts` | Modify | Implement `mockProvider()` (currently stubbed) |
| `packages/core/src/sender.ts` | Modify | Deprecate or redirect to client |

---

## 9. Deferred

- **`.enqueue()`** — queue integration (Layer 5), deferred to a later iteration
- **`$send()` dynamic dispatch** — runtime-determined route name, weaker typing. Not needed yet.
- **Plain-text fallback** — `html-to-text` conversion when adapter returns html only. Deferred.
- **`interface → type` migration** — existing code uses `interface` in many places. Will be a separate cleanup pass. New code uses `type` per CLAUDE.md.
- **oxlint config** — add `consistent-type-definitions` rule to enforce `type` over `interface`. Separate task.

---

## 10. Post-implementation revisions (2026-04-25)

Shape examples earlier in this doc reflect the original v1 implementation. The following changes were made post-merge — `plan/emailrpc-spec.md` is the canonical reference.

### `.email()` takes no id

Was: `t.email('welcome').input(...)`
Now: `t.email().input(...)`

The route id is the router map key. Stamping it twice was a footgun (typos silently produced wrong queue job names). The id is set on `def.id` at router-construction time.

### `.send()` separates transport from template input

Was: `mail.welcome.send({ to, name, verifyUrl }, { provider })` — recipient lived in the input schema.

Now:
```ts
mail.welcome.send({
  to: 'lucas@x.com',
  cc?, bcc?, replyTo?, headers?, attachments?,
  input: { name, verifyUrl },   // schema's domain
}, { provider });
```

`to`/`cc`/`bcc`/`replyTo`/`headers`/`attachments` are transport — never in the schema. `from` and `tags` deliberately stay out of `SendArgs`: they're contract-level. `.render(input)` is unchanged (rendering has no recipient).

### Type changes

- `EmailBuilder<Ctx, Id, S>` → `EmailBuilder<Ctx, S>` (id generic dropped)
- `EmailDefinition<Ctx, Id, TSchema, TAdapter>` → `EmailDefinition<Ctx, TSchema, TAdapter>` (`id: string`, stamped by router)
- New: `SendArgs<TInput>` exported from `@emailrpc/core`
- `RootBuilder<Ctx>` exposes only `email()` and `router()`; `_options` / `_ctx` moved to internal `InternalRootBuilder<Ctx>`
