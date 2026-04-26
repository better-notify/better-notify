---
'@emailrpc/core': minor
'@emailrpc/react-email': minor
'@emailrpc/mjml': minor
'@emailrpc/handlebars': minor
---

Widen the template contract and ship the real `@emailrpc/react-email` adapter.

**Core:**

- `TemplateAdapter<TInput>` is now `TemplateAdapter<TInput, TCtx = unknown>`. The `render` method receives `{ input, ctx }` instead of `input`. `Ctx` flows from `emailRpc.init<Ctx>()` through the builder into the adapter, fully typed.
- `EmailRouter<M>` is now `EmailRouter<M, Ctx>`. Exported `CtxOf<R>` extracts the router's context type.
- `createClient` accepts `ctx?: CtxOf<R>` (typed) and seeds it as the runtime initial context for every send. Previously `initialCtx` was always `{}`.
- `.template()` accepts either a `TemplateAdapter` (third-party form) or a render function `({ input, ctx }) => RenderedOutput | Promise<RenderedOutput>`. The function form gives oRPC-style auto-inference: `input` and `ctx` are typed by the builder, no explicit generics needed.
- `RenderOptions` adds an optional `ctx` field for `mail.welcome.render(input, { ctx, format })` standalone preview/dev calls.

**`@emailrpc/react-email`:**

- Real implementation. `reactEmail(Component, props, opts?)` renders a React Email component to `{ html, text? }`. Designed to be returned from inside `.template((args) => reactEmail(Component, props))` so the surrounding builder method gives you fully-typed `args`.
- Options: `plainText: true` produces a plain-text alternative via `react-email`'s `toPlainText`; `pretty: true` formats HTML with indentation.
- New runtime peer: `react-email ^6.0.0` (replaces direct `@react-email/render` usage). React 18 and 19 supported via the existing `react ^18 || ^19` peer.

**`@emailrpc/mjml` and `@emailrpc/handlebars`:**

- Stub render signatures updated to the new `({ input, ctx })` shape so they typecheck against the widened `TemplateAdapter`. Implementations remain stubs (`EmailRpcNotImplementedError`); real renders ship in their own future releases.

**Migration for existing inline adapters:**

```ts
// before
.template({ render: async (input) => ({ html: '...' }) })

// after — destructure
.template({ render: async ({ input }) => ({ html: '...' }) })

// or use the new render-function form
.template(({ input, ctx }) => ({ html: '...' }))
```
