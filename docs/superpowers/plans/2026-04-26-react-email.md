# @emailrpc/react-email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the real `@emailrpc/react-email` template adapter and widen `TemplateAdapter` in `@emailrpc/core` so `render` receives `{ input, ctx }` and the adapter is generic over both `TInput` and `TCtx`.

**Architecture:** Two phases. Phase 1: widen `TemplateAdapter<TInput, TCtx = unknown>`, thread `Ctx` through `EmailBuilder.template()` and `EmailDefinition`, update both render call sites in `client.ts`, migrate every inline adapter usage across core tests, mjml/handlebars stubs, and the example app — all in one cohesive sweep so CI never goes red between commits. Phase 2: implement `reactEmail(Component, mapToProps, opts?)` against `@react-email/render`, add focused tests with a tiny inline component, ship README + changeset.

**Tech Stack:** TypeScript, vitest, rolldown, React 18+, `@react-email/render` 1.x.

**Spec:** `docs/superpowers/specs/2026-04-26-react-email-design.md`

---

## File Structure

**Phase 1 — contract widening (Task 1):**

Modify:
- `packages/core/src/template.ts` — add `TCtx` generic, change `render` arg shape
- `packages/core/src/builder.ts` — thread `Ctx` into `.template()` constraint and `EmailDefinition`
- `packages/core/src/client.ts` — update both `def.template.render(...)` call sites; add `ctx?: TCtx` to `RenderOptions`
- `packages/core/src/builder.test.ts`, `client.test.ts`, `router.test.ts`, `worker.test.ts`, `plugins/types.test.ts`, `lib/test-utils.test.ts` — migrate inline adapters
- `packages/mjml/src/index.ts`, `packages/mjml/src/index.test.ts`
- `packages/handlebars/src/index.ts`, `packages/handlebars/src/index.test.ts`
- `examples/welcome-text/packages/emails/src/index.ts` — `textTemplate` helper

**Phase 2 — reactEmail (Tasks 2-4):**

Modify:
- `packages/react-email/package.json` — add `react` + `@react-email/render` to devDependencies
- `packages/react-email/src/index.ts` — replace stub with implementation
- `packages/react-email/src/index.test.ts` — replace stub test with real suite

Add:
- `packages/react-email/README.md`
- `.changeset/<random>.md`

Modify (Phase 2 docs):
- `plan/emailrpc-spec.md` — update `TemplateAdapter` snippets

---

### Task 1: Widen `TemplateAdapter` contract and migrate every consumer

**Files:**
- Modify: `packages/core/src/template.ts`
- Modify: `packages/core/src/builder.ts`
- Modify: `packages/core/src/client.ts`
- Modify: `packages/core/src/builder.test.ts`, `packages/core/src/client.test.ts`, `packages/core/src/router.test.ts`, `packages/core/src/worker.test.ts`, `packages/core/src/plugins/types.test.ts`, `packages/core/src/lib/test-utils.test.ts`
- Modify: `packages/mjml/src/index.ts`, `packages/mjml/src/index.test.ts`
- Modify: `packages/handlebars/src/index.ts`, `packages/handlebars/src/index.test.ts`
- Modify: `examples/welcome-text/packages/emails/src/index.ts`

This is the contract-breaking sweep. Done as one task because the contract widening leaves *every* inline adapter unable to compile until they're migrated. Splitting across multiple commits would leave CI red in between.

- [ ] **Step 1: Update `packages/core/src/template.ts`**

Replace the file's contents with:

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

- [ ] **Step 2: Update `packages/core/src/builder.ts`**

Locate the existing `template<A extends TemplateAdapter<InferOutput<CompleteSchema<S>>>>(` (around line 109). Replace with:

```ts
template<A extends TemplateAdapter<InferOutput<CompleteSchema<S>>, Ctx>>(
  adapter: Has<S, 'template'> extends true ? never : Has<S, 'input'> extends true ? A : never,
): EmailBuilder<Ctx, SetSlot<S, 'template', A>> {
  return createEmailBuilder<Ctx, SetSlot<S, 'template', A>>({
    ...this.slots,
    template: adapter as TemplateAdapter<unknown, Ctx>,
  });
}
```

Also update the `EmailDefinition` slot type (around line 153): change `template: TemplateAdapter<any>` to `template: TemplateAdapter<any, any>`.

Update the type-level slot reader `EmailDefinitionOf` if it references `TemplateAdapter<...>` with one type param — change to two (with `any` for `TCtx` if reading erased shape).

Update line 11 (`TAdapter extends TemplateAdapter<InferOutput<TSchema>>` in the `EmailDefinition` type def): becomes `TAdapter extends TemplateAdapter<InferOutput<TSchema>, any>`.

Update line 56 (`S['template'] extends TemplateAdapter<any> ?`) → `S['template'] extends TemplateAdapter<any, any> ?`.

Update line 62 (`template: TemplateAdapter<unknown> | undefined`) → `template: TemplateAdapter<unknown, unknown> | undefined`.

Update line 164 (`TAdapter extends TemplateAdapter<InferOutput<TSchema>>`) → `TAdapter extends TemplateAdapter<InferOutput<TSchema>, any>`.

- [ ] **Step 3: Update `packages/core/src/client.ts`**

Locate `RenderOptions` (around line 86):

```ts
export type RenderOptions = {
  format: 'html' | 'text';
};
```

Replace with two-overload-friendly shape:

```ts
export type RenderOptions<TCtx = unknown> = {
  format?: 'html' | 'text';
  ctx?: TCtx;
};
```

Update `RouteMethods` (around line 90):

```ts
type RouteMethods<TInput, P extends readonly TransportEntry[]> = {
  send(args: SendArgs<TInput>, opts?: SendOptions<P>): Promise<SendResult>;
  render(input: TInput, opts?: { ctx?: unknown }): Promise<RenderedOutput>;
  render(input: TInput, opts: { format: 'html' | 'text'; ctx?: unknown }): Promise<string>;
};
```

(`unknown` for `ctx` here keeps the route-level signature simple; the typed-Ctx flow is via the adapter's `TCtx` generic, not the route method.)

In `executeRender` (around line 211-223):

```ts
const executeRender = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
  rawInput: unknown,
  opts?: { format?: 'html' | 'text'; ctx?: unknown },
): Promise<RenderedOutput | string> => {
  const input = await validate(def.schema, rawInput, { route: def.id });
  const rendered = await def.template.render({ input, ctx: opts?.ctx ?? {} });

  if (!opts?.format) return rendered;

  if (opts.format === 'html') return rendered.html;
  return rendered.text ?? '';
};
```

In the `core` SendCore function inside `runSend` (around line 384), the line `const renderTuple = await handlePromise(def.template.render(input));` becomes:

```ts
const renderTuple = await handlePromise(def.template.render({ input, ctx: currentCtx }));
```

In the route `render` method binding (around line 594) where the closure calls `executeRender`, ensure the `renderOpts` is forwarded as-is — `executeRender` now accepts the new shape, so no further changes there.

- [ ] **Step 4: Migrate inline adapters across core test files**

Pattern: every inline `{ render: async (input) => ({ ... }) }` becomes `{ render: async ({ input }) => ({ ... }) }`. Every `{ render: async () => ({ ... }) }` (no input) stays the same shape but the engineer should still verify the destructure isn't needed.

For each file below, search for `render: async` and replace per-occurrence:

`packages/core/src/builder.test.ts`:
- Line 12: `render: async () => ({ html: '<p>hi</p>' })` — stays as-is (no input used)
- Line 63: same
- Line 95: `render: async (input) => { ... }` becomes `render: async ({ input }) => { ... }`
- Line 129, 142: stay as-is (no input)

`packages/core/src/client.test.ts`:
- Line 14 (`stubAdapter`): `render: async (input) => ({ html: \`<p>Hello ${input.name}</p>\`, text: \`Hello ${input.name}\` })` becomes `render: async ({ input }) => ({ html: \`<p>Hello ${input.name}</p>\`, text: \`Hello ${input.name}\` })`
- Line 76: stays (no input)
- Line 160: `render: async () => ({ ... })` stays
- Lines 592, 624: `render: async () => { throw new Error(...) }` stays
- Lines 796, 824, 857, 980, 1044, 1145: stay (no input)
- Line 1010: stays (throws)
- Line 1061: `render: async (input) => ({ ... })` becomes `render: async ({ input }) => ({ ... })`

`packages/core/src/router.test.ts`:
- Line 8: `render: async () => ({ html: '' })` stays

`packages/core/src/worker.test.ts`:
- Line 13: `render: async () => ({ html: '' })` stays

`packages/core/src/plugins/types.test.ts`: search for `render: async` and update if any take `input`.

`packages/core/src/lib/test-utils.test.ts`: search for `render: async` and update.

After this step, run `pnpm --filter @emailrpc/core typecheck` to find any missed sites; fix one-by-one until clean.

- [ ] **Step 5: Migrate mjml stub**

`packages/mjml/src/index.ts` — locate the existing stub adapter. Update the `render` field to take `{ input, ctx }` and still throw `EmailRpcNotImplementedError`. The exact change depends on the current stub shape; the resulting render should look like:

```ts
return {
  render: async (_args: { input: TInput; ctx: unknown }) => {
    throw new EmailRpcNotImplementedError('@emailrpc/mjml (v0.2)');
  },
};
```

`packages/mjml/src/index.test.ts` — update the call site that invokes `adapter.render(...)` from `adapter.render({ name: 'x' })` to `adapter.render({ input: { name: 'x' }, ctx: {} })`.

- [ ] **Step 6: Migrate handlebars stub**

Same pattern as Step 5, applied to `packages/handlebars/src/index.ts` and `packages/handlebars/src/index.test.ts`.

- [ ] **Step 7: Migrate the example `textTemplate` helper**

`examples/welcome-text/packages/emails/src/index.ts` — the helper currently looks like:

```ts
const textTemplate = <TInput>(body: (input: TInput) => string): TemplateAdapter<TInput> => {
  return {
    render: async (input) => {
      const text = body(input);
      return { text, html: `<pre style="...">${escapeHtml(text)}</pre>` };
    },
  };
};
```

Update to:

```ts
const textTemplate = <TInput>(body: (input: TInput) => string): TemplateAdapter<TInput> => {
  return {
    render: async ({ input }) => {
      const text = body(input);
      return { text, html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</pre>` };
    },
  };
};
```

(Body is unchanged; only the destructure changes.)

- [ ] **Step 8: Run repo-wide CI**

Run: `pnpm run ci`
Expected: 26/26 turbo tasks pass. All 330+ core tests pass. Lint clean (one pre-existing test.ts warning is acceptable).

If anything fails, fix the affected file and re-run. Do NOT proceed to commit until clean.

- [ ] **Step 9: Stage (do not commit)**

```bash
git add packages/core/src/template.ts packages/core/src/builder.ts packages/core/src/client.ts \
  packages/core/src/builder.test.ts packages/core/src/client.test.ts packages/core/src/router.test.ts \
  packages/core/src/worker.test.ts packages/core/src/plugins/types.test.ts \
  packages/core/src/lib/test-utils.test.ts \
  packages/mjml/src/index.ts packages/mjml/src/index.test.ts \
  packages/handlebars/src/index.ts packages/handlebars/src/index.test.ts \
  examples/welcome-text/packages/emails/src/index.ts
```

Per project rule: do NOT run `git commit`. Surface the diff for the user to commit.

---

### Task 2: Add devDependencies and write failing reactEmail tests

**Files:**
- Modify: `packages/react-email/package.json`
- Modify: `packages/react-email/src/index.test.ts`

- [ ] **Step 1: Add devDependencies**

In `packages/react-email/package.json`, add to `devDependencies`:

```json
"@react-email/render": "^1.0.0",
"react": "^19.0.0",
"@types/react": "^19.0.0",
```

Keep the existing `peerDependencies` ranges intact (`react: "^18.0.0 || ^19.0.0"` for downstream compat).

Run: `pnpm install` from the repo root to pick up the new deps.

- [ ] **Step 2: Replace `packages/react-email/src/index.test.ts` with the full failing suite**

```ts
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { reactEmail } from './index.js';

const Welcome = ({ name }: { name: string }) =>
  createElement(
    'html',
    null,
    createElement('body', null, createElement('h1', null, `Hello, ${name}!`)),
  );

describe('reactEmail', () => {
  it('produces html only by default (no plainText)', async () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      ({ input }) => ({ name: input.user }),
    );
    const result = await adapter.render({ input: { user: 'John' }, ctx: {} });
    expect(result.html).toContain('Hello, John!');
    expect(result.text).toBeUndefined();
  });

  it('produces both html and text when plainText: true', async () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      ({ input }) => ({ name: input.user }),
      { plainText: true },
    );
    const result = await adapter.render({ input: { user: 'John' }, ctx: {} });
    expect(result.html).toContain('Hello, John!');
    expect(result.text).toBeDefined();
    expect(result.text).toContain('Hello, John!');
    expect(result.text).not.toContain('<h1');
  });

  it('passes input and ctx into the mapper', async () => {
    let captured: { input: unknown; ctx: unknown } | null = null;
    const adapter = reactEmail<{ user: string }, { baseUrl: string }, { name: string }>(
      Welcome,
      (args) => {
        captured = args;
        return { name: args.input.user };
      },
    );
    await adapter.render({ input: { user: 'John' }, ctx: { baseUrl: 'https://x.com' } });
    expect(captured).toEqual({
      input: { user: 'John' },
      ctx: { baseUrl: 'https://x.com' },
    });
  });

  it('mapper return is passed as component props', async () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      () => ({ name: 'mapped-name' }),
    );
    const result = await adapter.render({ input: { user: 'John' }, ctx: {} });
    expect(result.html).toContain('mapped-name');
    expect(result.html).not.toContain('John');
  });

  it('propagates errors thrown from the mapper', async () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      () => {
        throw new Error('mapper boom');
      },
    );
    await expect(
      adapter.render({ input: { user: 'John' }, ctx: {} }),
    ).rejects.toThrow('mapper boom');
  });

  it('propagates errors thrown from the component', async () => {
    const Boom = () => {
      throw new Error('component boom');
    };
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Boom as unknown as typeof Welcome,
      ({ input }) => ({ name: input.user }),
    );
    await expect(
      adapter.render({ input: { user: 'John' }, ctx: {} }),
    ).rejects.toThrow('component boom');
  });

  it('pretty: true produces multi-line html', async () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      ({ input }) => ({ name: input.user }),
      { pretty: true },
    );
    const result = await adapter.render({ input: { user: 'John' }, ctx: {} });
    expect(result.html).toContain('\n');
  });

  it('reactEmail() returns synchronously without performing I/O', () => {
    const adapter = reactEmail<{ user: string }, unknown, { name: string }>(
      Welcome,
      ({ input }) => ({ name: input.user }),
    );
    expect(typeof adapter.render).toBe('function');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @emailrpc/react-email exec vitest run src/index.test.ts`
Expected: FAIL — current stub throws `not implemented` for every render call. The tests that don't call render (like the synchronous-construction one) may still pass; that's fine.

- [ ] **Step 4: Stage (do not commit)**

```bash
git add packages/react-email/package.json packages/react-email/src/index.test.ts pnpm-lock.yaml
```

---

### Task 3: Implement `reactEmail`

**Files:**
- Modify: `packages/react-email/src/index.ts`

- [ ] **Step 1: Replace the stub with the real implementation**

Overwrite `packages/react-email/src/index.ts`:

```ts
import { createElement, type ReactElement } from 'react';
import { render } from '@react-email/render';
import type { TemplateAdapter } from '@emailrpc/core';

export type ReactEmailAdapterOptions = {
  plainText?: boolean;
  pretty?: boolean;
};

export type ReactEmailComponent<TProps> = (props: TProps) => ReactElement;

export type ReactEmailMapper<TInput, TCtx, TProps> = (
  args: { input: TInput; ctx: TCtx },
) => TProps;

/**
 * Build a `TemplateAdapter` that renders a React Email component.
 *
 * The mapper receives `{ input, ctx }` (input from the route's validated
 * schema; ctx from `emailRpc.init<Ctx>()`) and returns the component's props.
 * This lets templates reshape, rename, or compute props without coupling the
 * component's prop names to the schema field names.
 *
 * By default only `html` is produced. Pass `{ plainText: true }` to also
 * generate a text alternative via `@react-email/render`'s plainText mode.
 *
 * ```ts
 * .template(reactEmail(WelcomeEmail, ({ input, ctx }) => ({
 *   link: `${ctx.baseUrl}/verify?t=${input.token}`,
 * })))
 * ```
 */
export const reactEmail = <TInput, TCtx, TProps extends object>(
  Component: ReactEmailComponent<TProps>,
  mapToProps: ReactEmailMapper<TInput, TCtx, TProps>,
  opts?: ReactEmailAdapterOptions,
): TemplateAdapter<TInput, TCtx> => {
  return {
    render: async ({ input, ctx }) => {
      const props = mapToProps({ input, ctx });
      const element = createElement(Component, props);
      const html = await render(element, { pretty: opts?.pretty ?? false });
      if (opts?.plainText) {
        const text = await render(element, { plainText: true });
        return { html, text };
      }
      return { html };
    },
  };
};
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @emailrpc/react-email exec vitest run src/index.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 3: Run typecheck and build**

Run: `pnpm --filter @emailrpc/react-email typecheck && pnpm --filter @emailrpc/react-email build`
Expected: both PASS.

- [ ] **Step 4: Run repo-wide CI**

Run: `pnpm run ci`
Expected: 26/26 green.

- [ ] **Step 5: Stage (do not commit)**

```bash
git add packages/react-email/src/index.ts
```

---

### Task 4: README + changeset + spec doc update

**Files:**
- Add: `packages/react-email/README.md`
- Add: `.changeset/<random>.md`
- Modify: `plan/emailrpc-spec.md`

- [ ] **Step 1: Write the React Email README**

Create `packages/react-email/README.md`:

````markdown
# @emailrpc/react-email

React Email template adapter for [emailRpc](../core).

## Install

```sh
pnpm add @emailrpc/react-email @emailrpc/core react @react-email/render
```

## Usage

```tsx
import { z } from 'zod';
import { emailRpc } from '@emailrpc/core';
import { reactEmail } from '@emailrpc/react-email';
import { Html, Body, Heading, Link } from '@react-email/components';

const WelcomeEmail = ({ name, link }: { name: string; link: string }) => (
  <Html>
    <Body>
      <Heading>Hi {name}</Heading>
      <Link href={link}>Verify your email</Link>
    </Body>
  </Html>
);

const t = emailRpc.init<{ baseUrl: string }>();

export const router = t.router({
  welcome: t.email()
    .input(z.object({ name: z.string(), token: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(reactEmail(WelcomeEmail, ({ input, ctx }) => ({
      name: input.name,
      link: `${ctx.baseUrl}/verify?t=${input.token}`,
    }))),
});
```

## API

### `reactEmail(Component, mapToProps, opts?)`

| Arg | Type | Notes |
|---|---|---|
| `Component` | `(props: TProps) => ReactElement` | Your React Email component. |
| `mapToProps` | `({ input, ctx }) => TProps` | Maps the route's validated input + router ctx to the component's props. |
| `opts.plainText` | `boolean` (default `false`) | When `true`, also produces a plain-text alternative via `@react-email/render`'s plainText mode. |
| `opts.pretty` | `boolean` (default `false`) | When `true`, formats the rendered HTML with indentation/newlines. |

Returns a `TemplateAdapter<TInput, TCtx>` ready to pass to `.template(...)`.

## Why a mapper?

The mapper decouples your validated input shape from the component's prop names. You can rename, reshape, or compute props (build URLs, format dates, derive classes) without forcing the component to mirror the schema. The mapper also receives router-level `ctx`, which is fully typed when you use `emailRpc.init<Ctx>()`.
````

- [ ] **Step 2: Update `plan/emailrpc-spec.md`**

Locate the `TemplateAdapter` type definition snippet in the spec (search for `TemplateAdapter<` in the file). Update from the old single-generic `(input: TInput) => Promise<RenderedOutput>` form to:

```ts
export type TemplateAdapter<TInput, TCtx = unknown> = {
  readonly render: (args: { input: TInput; ctx: TCtx }) => Promise<RenderedOutput>;
};
```

Locate any code samples in the spec that show inline adapters (search for `render: async`). Update each to the new `({ input, ctx }) => ...` shape.

If the spec has a §5 (or similar) for templates, note that ctx flows from `emailRpc.init<Ctx>()` through `.template()` into the adapter, and that mappers receive `{ input, ctx }` — see `@emailrpc/react-email` for the canonical mapper-based adapter.

- [ ] **Step 3: Add a changeset**

Create `.changeset/react-email.md`:

```markdown
---
'@emailrpc/core': minor
'@emailrpc/react-email': minor
'@emailrpc/mjml': minor
'@emailrpc/handlebars': minor
---

Widen `TemplateAdapter` to `TemplateAdapter<TInput, TCtx = unknown>`. The `render` method now receives `{ input, ctx }` instead of `input`. `Ctx` flows from `emailRpc.init<Ctx>()` through `.template()` into the adapter, fully typed.

Implement `@emailrpc/react-email` against `@react-email/render`. New `reactEmail(Component, mapToProps, opts?)` factory accepts a React Email component and a `({ input, ctx }) => props` mapper. Options: `plainText?: boolean` (default false), `pretty?: boolean` (default false).

`@emailrpc/mjml` and `@emailrpc/handlebars` stub render signatures updated to the new shape; their implementations remain stubs (`EmailRpcNotImplementedError`) and ship in their own future releases.

Migration: existing inline `TemplateAdapter` usages must update from `render(input)` to `render({ input, ctx })`. The destructure is the only change; behavior is identical.
```

- [ ] **Step 4: Run repo-wide CI**

Run: `pnpm run ci`
Expected: 26/26 green.

- [ ] **Step 5: Stage**

```bash
git add packages/react-email/README.md .changeset/react-email.md plan/emailrpc-spec.md
```

---

## Self-review notes

- Spec coverage:
  - §Public API → Task 3 (impl)
  - §Behavior → Task 3 (steps in render: mapper → createElement → render html → optional render text)
  - §Core contract changes (template.ts, builder.ts, client.ts, RouteMethods overloads) → Task 1
  - §Internal usages migrated → Task 1 (steps 4-7)
  - §Adapter package stubs (mjml, handlebars) → Task 1 (steps 5-6)
  - §File structure → Task 1-4 file lists match
  - §Testing strategy (8 cases) → Task 2 (full suite, all 8 cases)
  - §Touch list summary → 14 modify + 2 add → matches plan
  - §Open follow-ups → out of scope, noted in changeset
- All async error handling uses `handlePromise` already in `client.ts` (no new try/catch added in core). The reactEmail adapter does not need `handlePromise` — its render method awaits directly and lets exceptions propagate, which is correct per the spec.
- File naming follows kebab-case (already enforced by oxlint).
- No comments added to source files except JSDoc on the public `reactEmail` factory (per project convention: JSDoc on public-API surface only).
- Per the project's "Don't commit unless I request" rule, every task ends with `git add` only — never `git commit`. The user reviews and commits manually.
