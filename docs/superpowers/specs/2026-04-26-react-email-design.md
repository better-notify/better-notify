# @emailrpc/react-email Design

> **Status:** Approved 2026-04-26. Ready for plan.

## Goal

Replace the stub at `packages/react-email/src/index.ts` with a real `reactEmail(Component, mapToProps, opts?)` template adapter that renders React Email components via `@react-email/render`, threads typed router context into a prop-mapping function, and returns `{ html, text? }` for the emailRpc render pipeline.

This requires a one-time core contract widening: `TemplateAdapter<TInput, TCtx = unknown>` with `render({ input, ctx })`. Existing adapters and call sites are migrated mechanically.

## Non-goals

- **Inline asset (CID) handling.** The previous stub had `inlineAssets?` in options; we drop it. Inline assets ship in v0.3 alongside attachment plumbing.
- **Subject extraction from the component.** Subject is set at the contract layer via `.subject(...)`. The adapter never produces subject.
- **Real `@emailrpc/mjml` / `@emailrpc/handlebars` implementations.** Their stubs are migrated to the new render signature so they typecheck; real renders are separate sessions.
- **Server components / streaming render.** `@react-email/render` returns a Promise<string>; we await it. No streaming.
- **Built-in HTML-to-text outside `@react-email/render`.** We use the library's own `plainText: true` mode rather than introducing a separate `html-to-text` dep.

## Public API

```ts
import type { ReactElement } from 'react';
import type { TemplateAdapter } from '@emailrpc/core';

export type ReactEmailAdapterOptions = {
  plainText?: boolean;
  pretty?: boolean;
};

export type ReactEmailComponent<TProps> = (props: TProps) => ReactElement;

export type ReactEmailMapper<TInput, TCtx, TProps> = (
  args: { input: TInput; ctx: TCtx },
) => TProps;

export const reactEmail: <TInput, TCtx, TProps extends object>(
  Component: ReactEmailComponent<TProps>,
  mapToProps: ReactEmailMapper<TInput, TCtx, TProps>,
  opts?: ReactEmailAdapterOptions,
) => TemplateAdapter<TInput, TCtx>;
```

Defaults: `plainText: false`, `pretty: false`.

### Behavior

1. Returned adapter's `render({ input, ctx })`:
   1. `props = mapToProps({ input, ctx })`
   2. `element = createElement(Component, props)` (using `react`'s `createElement`, no JSX in our code)
   3. `html = await render(element, { pretty: opts.pretty ?? false })`
   4. If `opts.plainText === true`: `text = await render(element, { plainText: true })`
   5. Return `{ html, text? }` — `text` only present when opt-in.
2. Errors from `mapToProps`, `Component`, or `@react-email/render` propagate unchanged. The client pipeline already catches them via the `render failed` log path and wraps in `EmailRpcError({ code: 'RENDER' })`.
3. The adapter is **stateless and synchronously constructed** — `reactEmail()` returns immediately with no I/O. All work happens in `render()`.

## Core contract changes

### `packages/core/src/template.ts`

```ts
export type RenderedOutput = {
  html: string;
  text?: string;
  subject?: string;
};

export type TemplateAdapter<TInput, TCtx = unknown> = {
  readonly render: (args: { input: TInput; ctx: TCtx }) => Promise<RenderedOutput>;
};

export type AnyTemplateAdapter = TemplateAdapter<any, any>;
```

Two changes from the current contract:
- Second generic `TCtx` (defaults to `unknown`)
- `render` signature: `(args: { input, ctx }) => ...` instead of `(input) => ...`

### `packages/core/src/builder.ts`

`.template()` already constrains the adapter via `TemplateAdapter<InferOutput<CompleteSchema<S>>>`. We thread the builder's `Ctx` generic into the second slot:

```ts
template<A extends TemplateAdapter<InferOutput<CompleteSchema<S>>, Ctx>>(
  adapter: ...,
): EmailBuilder<Ctx, SetSlot<S, 'template', A>>
```

`EmailDefinition` slot widens accordingly: `template: TemplateAdapter<TInput, Ctx>`.

### `packages/core/src/client.ts`

Two call sites:

1. `executeRender` (the standalone `mail.welcome.render(input, opts)` method): currently `def.template.render(input)`. Becomes `def.template.render({ input, ctx: opts?.ctx ?? {} as any })`.
2. The inner `core` SendCore function inside `runSend`: currently `def.template.render(input)`. Becomes `def.template.render({ input, ctx: currentCtx })` where `currentCtx` is the middleware-accumulated ctx.

Route method signature (`RouteMethods<TInput, P>`) gains `ctx?` on the render opts. Two overloads (cleanly disambiguated by presence of `format`):

```ts
render(input: TInput, opts?: { ctx?: TCtx }): Promise<RenderedOutput>;
render(input: TInput, opts: { format: 'html' | 'text'; ctx?: TCtx }): Promise<string>;
```

`mail.welcome.render(input)` keeps working unchanged; `mail.welcome.render(input, { ctx })` adds typed ctx for preview/dev; `mail.welcome.render(input, { format: 'html', ctx })` keeps the format-narrowed return.

### Internal usages migrated

Every file that defines an inline `TemplateAdapter` or calls `render` gets the new signature:

- `packages/core/src/client.test.ts` — `stubAdapter` and several inline `{ render: async () => ({ html: ... }) }` usages
- `packages/core/src/lib/test-utils.test.ts` — `adapter` fixture
- `packages/core/src/builder.test.ts`, `router.test.ts` — any inline adapters
- `packages/core/src/plugins/types.test.ts` — same
- `examples/welcome-text/packages/emails/src/index.ts` — `textTemplate` helper updated to new render signature; existing call sites in the router get `({ input, ctx }) => ...` instead of `(input) => ...`

### Adapter package stubs

`@emailrpc/mjml/src/index.ts` and `@emailrpc/handlebars/src/index.ts` are stubs that throw `EmailRpcNotImplementedError` at render time. We update their `render` signatures to the new `({ input, ctx })` shape (still throws). Their tests likewise.

## File structure

**Modify:**
- `packages/react-email/package.json` — add `react` and `@react-email/render` as `devDependencies` so tests can `import` from them. Peer ranges stay intact for downstream consumers.
- `packages/core/src/template.ts` — widen `TemplateAdapter`
- `packages/core/src/builder.ts` — thread Ctx into `.template()` constraint and `EmailDefinition`
- `packages/core/src/client.ts` — call sites + `render()` opts
- `packages/core/src/client.test.ts` — migrate inline adapters
- `packages/core/src/builder.test.ts` — migrate inline adapters (if any)
- `packages/core/src/router.test.ts` — same
- `packages/core/src/plugins/types.test.ts` — same
- `packages/core/src/lib/test-utils.test.ts` — same
- `packages/mjml/src/index.ts` — update render signature (still stub)
- `packages/mjml/src/index.test.ts` — same
- `packages/handlebars/src/index.ts` — same
- `packages/handlebars/src/index.test.ts` — same
- `packages/react-email/src/index.ts` — replace stub with real implementation
- `packages/react-email/src/index.test.ts` — replace stub test with real suite
- `examples/welcome-text/packages/emails/src/index.ts` — update `textTemplate` helper
- `plan/emailrpc-spec.md` — update `TemplateAdapter` snippets

**Add:**
- `packages/react-email/README.md` — short usage doc with the prop-mapper example
- `.changeset/<random>.md` — `@emailrpc/core` minor (breaking type), `@emailrpc/react-email` minor

No new core files; this is a contract change spread across the existing tree.

## Testing strategy

Adapter tests in `packages/react-email/src/index.test.ts`. Use a tiny inline React Email component as fixture so tests don't pull `@react-email/components` (peer optional in `package.json`).

```tsx
const Welcome = ({ name }: { name: string }) => (
  React.createElement('html', null,
    React.createElement('body', null,
      React.createElement('h1', null, `Hello, ${name}!`),
    ),
  )
);
```

Coverage matrix:

1. **html-only by default** — `reactEmail(Welcome, ({ input }) => ({ name: input.name }))` returns `{ html }` with `text === undefined`. Asserts the rendered HTML contains "Hello, John!" for input `{ name: 'John' }`.
2. **plainText: true produces both** — same setup with `opts.plainText: true`. Asserts `result.text` is defined and contains "Hello, John!" without HTML tags.
3. **mapper receives input and ctx** — pass an arrow-fn mapper that captures its args; assert it received the exact `{ input, ctx }` shape after a render call. Use `ctx = { baseUrl: 'https://x.com' }` and confirm the mapper sees both fields.
4. **mapper return becomes component props** — mapper returns `{ name: 'mapped-name' }` regardless of input; assert HTML contains "mapped-name".
5. **mapper throws** — mapper that throws `new Error('boom')`; `render({ input, ctx })` rejects with the same error.
6. **component throws** — component implementation that throws; render rejects.
7. **pretty: true** — passes `pretty: true` through to `@react-email/render`. Assert HTML contains newlines/indentation (rough heuristic, not strict format check).
8. **synchronous construction** — `reactEmail(...)` returns without throwing or awaiting. Assert `typeof adapter.render === 'function'`.

Coverage target: 100% lines/branches in `reactEmail`. The thin wrapper means coverage falls out naturally from the matrix above.

**Core test migrations** are mechanical — every existing inline adapter `{ render: async (input) => ({ html: '...' }) }` becomes `{ render: async ({ input }) => ({ html: '...' }) }`. No new test cases added in core.

## Touch list summary

- 14 files modified (core: 8, adapter packages: 4, example: 1, spec: 1)
- 2 files added (README + changeset)
- 0 files deleted

## Open follow-ups (out of scope)

- Inline asset (CID) support — needs adapter-side asset registry and pipeline plumbing for `RenderedMessage.inlineAssets`
- Real `@emailrpc/mjml` and `@emailrpc/handlebars` implementations
- Subject extraction from React Email's `<Preview>` component (currently preview text is just rendered into the HTML; not surfaced as subject — and shouldn't be, since `<Preview>` is preheader text, not subject)
- React Server Components support — defer until upstream `@react-email/render` adds it
