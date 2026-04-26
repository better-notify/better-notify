# Hooks, Middleware & Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four-phase hook system, `.use()` builder middleware (oRPC-style sub-builders), and plugin lifecycle in `@emailrpc/core`, closing the gap to spec §8/§9.

**Architecture:** Builder gains `.use(mw)` returning a new builder with middleware appended; `EmailDefinition` carries a `middleware: Middleware[]` list. `createClient` runs an onion executor that wraps plugin middleware around route middleware around render+send. Hooks accept `T | T[]`, run in plugin-then-user order, with throws re-emitted as `onError(phase: 'hook')`. Plugins have `onCreate` / `onClose` lifecycle, contributing hooks and middleware that prepend to user values.

**Tech Stack:** TypeScript ≥ 5.4, Standard Schema, Vitest, Rolldown. Repo conventions: `type` over `interface`, no code comments, `handlePromise` over try/catch (already in `client.ts`).

**Working directory:** `/Users/lucasreis/Projects/emailrpc`. All paths below are relative to that root.

**Commit policy:** This repo's CLAUDE.md says don't commit unless requested. Each task ends with a "Checkpoint" — verify state, do NOT commit unless explicitly told to.

**Spec reference:** `docs/superpowers/specs/2026-04-25-hooks-middleware-plugins-design.md`.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/middleware.ts` | Modify | New `Middleware<TInput, TCtxIn, TCtxOut>` shape; real `loggerMw` / `dryRunMw` / `tagInjectMw`; remaining stubs throw |
| `packages/core/src/plugin.ts` | **Create** | `Plugin<R>` type, `composePlugins` helper |
| `packages/core/src/plugin.test.ts` | **Create** | Plugin lifecycle tests |
| `packages/core/src/builder.ts` | Modify | Add `middleware` slot to state; `.use()` method; thread middleware into `EmailDefinition` |
| `packages/core/src/builder.test.ts` | Modify | `.use()` returns new builder; sub-builder propagation |
| `packages/core/src/client.ts` | Major rewrite | Onion executor; multi-hook; plugin lifecycle; `mail.close()`; `onExecute`; `onError(phase: 'hook')` |
| `packages/core/src/client.test.ts` | Modify | Update existing hook tests; add multi-hook, `onExecute`, plugin tests |
| `packages/core/src/middleware.test.ts` | Modify | Real tests for the trivial three; onion ordering; short-circuit |
| `packages/core/src/init.ts` | Modify | Remove `InitHooks` |
| `packages/core/src/index.ts` | Modify | Export new types |

---

## Task 1: Update `Middleware` type signature

**Files:**
- Modify: `packages/core/src/middleware.ts`

- [ ] **Step 1: Open the file and replace the type definitions at the top**

Read `packages/core/src/middleware.ts:1-13` and replace the existing `MiddlewareParams` and `Middleware` types (and the `import` of `SendResult`) with:

```ts
import { EmailRpcNotImplementedError } from './errors.js';
import type { SendResult } from './types.js';

export type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn> = {
  input: TInput;
  ctx: TCtxIn;
  route: string;
  next: (newCtx?: Partial<TCtxOut>) => Promise<SendResult>;
};

export type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut>,
) => Promise<SendResult>;

export type AnyMiddleware = Middleware<any, any, any>;
```

Keep the existing stub function declarations (`loggerMw`, etc.) below — those are replaced in later tasks.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: passes (the only consumer today is the stub functions which still match the old `Middleware` because all three generics default).

- [ ] **Checkpoint:** No behavior change yet. Move to Task 2.

---

## Task 2: Create `Plugin` type module

**Files:**
- Create: `packages/core/src/plugin.ts`
- Create: `packages/core/src/plugin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/plugin.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Plugin } from './plugin.js';
import type { AnyEmailRouter } from './router.js';

describe('Plugin type', () => {
  it('accepts the minimum shape', () => {
    const p: Plugin = { name: 'x' };
    expectTypeOf(p).toMatchTypeOf<{ name: string }>();
  });

  it('accepts hooks, middleware, onCreate, onClose', () => {
    const p: Plugin<AnyEmailRouter> = {
      name: 'full',
      hooks: { onAfterSend: () => {} },
      middleware: [],
      onCreate: () => {},
      onClose: async () => {},
    };
    expectTypeOf(p.name).toEqualTypeOf<string>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @emailrpc/core exec vitest run src/plugin.test.ts`
Expected: FAIL — module `./plugin.js` not found.

- [ ] **Step 3: Create the plugin module**

Create `packages/core/src/plugin.ts`:

```ts
import type { AnyEmailRouter } from './router.js';
import type { AnyMiddleware } from './middleware.js';
import type { ClientHooks } from './client.js';

export type Plugin<R extends AnyEmailRouter = AnyEmailRouter> = {
  name: string;
  hooks?: ClientHooks<R>;
  middleware?: AnyMiddleware[];
  onCreate?: (params: { router: R }) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
};
```

Note: `ClientHooks<R>` does not yet exist as a generic; today's `client.ts` exports a non-generic `ClientHooks`. That gets fixed in Task 6. For now this import will type-check because TS allows referencing a soon-to-be-generic type by name; if it errors, temporarily declare `export type Plugin<R extends AnyEmailRouter = AnyEmailRouter> = { name: string; hooks?: unknown; middleware?: AnyMiddleware[]; onCreate?: (params: { router: R }) => void | Promise<void>; onClose?: () => void | Promise<void>; };` and tighten in Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @emailrpc/core exec vitest run src/plugin.test.ts`
Expected: PASS.

- [ ] **Checkpoint:** Plugin type exists. Imported by nothing yet.

---

## Task 3: Add `middleware` slot to builder state and `EmailDefinition`

**Files:**
- Modify: `packages/core/src/builder.ts`

- [ ] **Step 1: Extend `EmailDefinition` type**

Edit `packages/core/src/builder.ts`. Add an import at the top:

```ts
import type { AnyMiddleware } from './middleware.js';
```

Then change `EmailDefinition` (currently lines 7–21) to add a `middleware` field:

```ts
export type EmailDefinition<
  Ctx,
  TSchema extends AnyStandardSchema,
  TAdapter extends TemplateAdapter<InferOutput<TSchema>>,
> = {
  readonly _ctx: Ctx;
  readonly id: string;
  readonly schema: TSchema;
  readonly subject: SubjectResolver<InferOutput<TSchema>>;
  readonly template: TAdapter;
  readonly from: Address | undefined;
  readonly replyTo: Address | undefined;
  readonly tags: Tags;
  readonly priority: Priority;
  readonly middleware: ReadonlyArray<AnyMiddleware>;
};
```

- [ ] **Step 2: Extend `InternalBuilderState`**

Find `InternalBuilderState` (currently lines 56–65) and add `middleware`:

```ts
export type InternalBuilderState = {
  ctx: unknown;
  schema: AnyStandardSchema | undefined;
  subject: SubjectResolver<unknown> | undefined;
  template: TemplateAdapter<unknown> | undefined;
  from: Address | undefined;
  replyTo: Address | undefined;
  tags: Tags;
  priority: Priority;
  middleware: ReadonlyArray<AnyMiddleware>;
};
```

- [ ] **Step 3: Initialize `middleware` in `createEmailBuilder`**

Find `createEmailBuilder` (currently lines 161–172) and add `middleware: []` to the initial state:

```ts
export const createEmailBuilder = <Ctx>(ctx: { context?: Ctx }): EmailBuilder<Ctx> => {
  return new EmailBuilder<Ctx>({
    ctx: ctx.context,
    schema: undefined,
    subject: undefined,
    template: undefined,
    from: undefined,
    replyTo: undefined,
    tags: {},
    priority: 'normal',
    middleware: [],
  });
};
```

- [ ] **Step 4: Update `router.ts` to thread middleware into `EmailDefinition`**

Edit `packages/core/src/router.ts`. Find the body of `createRouter` (currently lines 40–67) where it builds `emails[key]`. Update the assignment to include `middleware`:

```ts
emails[key] = {
  _ctx: undefined as never,
  id: key,
  schema: state.schema,
  subject: state.subject,
  template: state.template,
  from: state.from,
  replyTo: state.replyTo,
  tags: state.tags,
  priority: state.priority,
  middleware: (state as { middleware?: ReadonlyArray<unknown> }).middleware ?? [],
} as EmailDefinitionOf<M[typeof key]>;
```

The cast on `state.middleware` is needed because `router.ts` types `state` loosely.

- [ ] **Step 5: Run all existing tests**

Run: `pnpm --filter @emailrpc/core test`
Expected: PASS (no test references `middleware` yet; default `[]` keeps existing behavior).

- [ ] **Checkpoint:** Builder state and EmailDefinition both carry `middleware: []` by default.

---

## Task 4: Add `.use()` method to `EmailBuilder`

**Files:**
- Modify: `packages/core/src/builder.ts`
- Modify: `packages/core/src/builder.test.ts`

- [ ] **Step 1: Write the failing test**

Open `packages/core/src/builder.test.ts` and add at the bottom:

```ts
import { z } from 'zod';
import { emailRpc } from './init.js';
import type { Middleware } from './middleware.js';

describe('EmailBuilder.use()', () => {
  it('returns a new builder, not the same instance', () => {
    const t = emailRpc.init();
    const mw: Middleware = async ({ next }) => next();
    const b1 = t.email();
    const b2 = b1.use(mw);
    expect(b2).not.toBe(b1);
  });

  it('appends middleware to the builder state', () => {
    const t = emailRpc.init();
    const mw1: Middleware = async ({ next }) => next();
    const mw2: Middleware = async ({ next }) => next();
    const b = t.email().use(mw1).use(mw2);
    const state = (b as unknown as { _state: { middleware: unknown[] } })._state;
    expect(state.middleware).toEqual([mw1, mw2]);
  });

  it('propagates middleware through subsequent slot calls', () => {
    const t = emailRpc.init();
    const mw: Middleware = async ({ next }) => next();
    const b = t
      .use(mw)
      .email()
      .input(z.object({ x: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) });
    const state = (b as unknown as { _state: { middleware: unknown[] } })._state;
    expect(state.middleware).toEqual([mw]);
  });

  it('makes middleware reach EmailDefinition via the router', () => {
    const t = emailRpc.init();
    const mw: Middleware = async ({ next }) => next();
    const welcome = t
      .use(mw)
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) });
    const router = t.router({ welcome });
    expect(router.emails.welcome.middleware).toEqual([mw]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/builder.test.ts -t "EmailBuilder.use"`
Expected: FAIL — `.use is not a function` and `t.use is not a function`.

- [ ] **Step 3: Add `.use()` to the `EmailBuilder` class**

In `packages/core/src/builder.ts`, add a method to the `EmailBuilder` class (place it just below the constructor, before `input`):

```ts
use<TCtxOut = Ctx>(
  middleware: Middleware<unknown, Ctx, TCtxOut>,
): EmailBuilder<TCtxOut, S> {
  return new EmailBuilder<TCtxOut, S>({
    ...this._state,
    middleware: [...this._state.middleware, middleware as AnyMiddleware],
  });
}
```

Add `Middleware` to the imports at the top:

```ts
import type { AnyMiddleware, Middleware } from './middleware.js';
```

- [ ] **Step 4: Add a root-level `use()` to `RootBuilder`**

The test calls `t.use(mw)` at the root. Open `packages/core/src/init.ts` and update `RootBuilder` and the runtime:

```ts
import { createEmailBuilder, type EmailBuilder } from './builder.js';
import { createRouter, type EmailRouter, type ValidateRouter } from './router.js';
import type { AnyMiddleware, Middleware } from './middleware.js';

export type InitOptions = Record<string, never>;

export type RootBuilder<Ctx> = {
  email(): EmailBuilder<Ctx>;
  use<TCtxOut = Ctx>(
    middleware: Middleware<unknown, Ctx, TCtxOut>,
  ): RootBuilder<TCtxOut>;
  router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>): EmailRouter<M>;
};

export type EmailRpc = {
  init<Ctx = {}>(opts?: InitOptions): RootBuilder<Ctx>;
};

const buildRoot = <Ctx>(rootMiddleware: ReadonlyArray<AnyMiddleware>): RootBuilder<Ctx> => ({
  email() {
    const builder = createEmailBuilder<Ctx>({});
    if (rootMiddleware.length === 0) return builder;
    const seeded = builder as unknown as {
      _state: { middleware: ReadonlyArray<AnyMiddleware> };
    };
    seeded._state = { ...seeded._state, middleware: [...rootMiddleware] };
    return builder;
  },
  use<TCtxOut = Ctx>(middleware: Middleware<unknown, Ctx, TCtxOut>) {
    return buildRoot<TCtxOut>([...rootMiddleware, middleware as AnyMiddleware]);
  },
  router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>) {
    return createRouter(map as never) as EmailRouter<M>;
  },
});

export const emailRpc: EmailRpc = {
  init<Ctx = {}>(_opts: InitOptions = {} as InitOptions): RootBuilder<Ctx> {
    return buildRoot<Ctx>([]);
  },
};
```

This removes `InitHooks` (per spec §9 migration). The `seeded` mutation is local — the builder is brand new and not yet observed.

- [ ] **Step 5: Run the new tests**

Run: `pnpm --filter @emailrpc/core exec vitest run src/builder.test.ts -t "EmailBuilder.use"`
Expected: PASS.

- [ ] **Step 6: Run full core test suite**

Run: `pnpm --filter @emailrpc/core test`
Expected: PASS. (Existing tests don't pass `hooks` to `init()`, so removing `InitHooks` is safe. If any test references `InitHooks` or passes `{ hooks: ... }` to `init()`, delete those references — that's the spec §9 migration.)

- [ ] **Checkpoint:** `.use()` works on root and on email builders, middleware propagates to `EmailDefinition`.

---

## Task 5: Hook context types — discriminated union

**Files:**
- Modify: `packages/core/src/client.ts`

- [ ] **Step 1: Add hook context type definitions**

In `packages/core/src/client.ts`, replace the existing `ClientHooks` type (currently lines 26–46) with the new typed system. Find this block and replace it:

```ts
export type ClientHooks = {
  onBeforeSend?: (params: { ... }) => void | Promise<void>;
  onAfterSend?: (params: { ... }) => void | Promise<void>;
  onError?: (params: { ... }) => void | Promise<void>;
};
```

Replace with:

```ts
export type RouteUnion<R extends AnyEmailRouter> = {
  [K in keyof R['emails'] & string]: { route: K; input: InputOf<R, K> };
}[keyof R['emails'] & string];

export type BeforeSendCtx<R extends AnyEmailRouter> = RouteUnion<R> & {
  args: SendArgs<unknown>;
  ctx: unknown;
  messageId: string;
};

export type ExecuteCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  rendered: RenderedMessage;
};

export type AfterSendCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  result: SendResult;
  durationMs: number;
};

export type ErrorPhase = 'validate' | 'middleware' | 'render' | 'send' | 'hook';

export type ErrorCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  error: EmailRpcError;
  phase: ErrorPhase;
};

export type HookFn<T> = (params: T) => void | Promise<void>;

export type ClientHooks<R extends AnyEmailRouter = AnyEmailRouter> = {
  onBeforeSend?: HookFn<BeforeSendCtx<R>> | HookFn<BeforeSendCtx<R>>[];
  onExecute?: HookFn<ExecuteCtx<R>> | HookFn<ExecuteCtx<R>>[];
  onAfterSend?: HookFn<AfterSendCtx<R>> | HookFn<AfterSendCtx<R>>[];
  onError?: HookFn<ErrorCtx<R>> | HookFn<ErrorCtx<R>>[];
};
```

- [ ] **Step 2: Update `CreateClientOptions` to be generic over the router**

Find `CreateClientOptions` (currently lines 48–57) and update:

```ts
export type CreateClientOptions<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> = {
  router: R;
  providers: P;
  defaults?: {
    from?: Address;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
  hooks?: ClientHooks<R>;
  plugins?: ReadonlyArray<Plugin<R>>;
};
```

Add to imports at top of `client.ts`:

```ts
import type { Plugin } from './plugin.js';
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: PASS. Existing call sites use `hooks: { onBeforeSend: ({ route, ... }) => ... }` which still satisfies `HookFn<T> | HookFn<T>[]`. Old fields like `messageId` on `onError` callback still match the new shape.

If any test file passes `phase` types as a string literal that's no longer in the union (e.g. `'something-else'`), update it. The new `phase` union is `'validate' | 'middleware' | 'render' | 'send' | 'hook'`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @emailrpc/core test`
Expected: PASS.

- [ ] **Checkpoint:** Hook contexts now discriminated unions; `plugins` field added to `CreateClientOptions` (unused).

---

## Task 6: Hook normalization helper + multi-registration

**Files:**
- Modify: `packages/core/src/client.ts`

- [ ] **Step 1: Add normalization helper**

Add a helper at the top of `client.ts` (above `executeRender`):

```ts
type AnyHooks = {
  onBeforeSend?: HookFn<any> | HookFn<any>[];
  onExecute?: HookFn<any> | HookFn<any>[];
  onAfterSend?: HookFn<any> | HookFn<any>[];
  onError?: HookFn<any> | HookFn<any>[];
};

type NormalizedHooks = {
  onBeforeSend: HookFn<any>[];
  onExecute: HookFn<any>[];
  onAfterSend: HookFn<any>[];
  onError: HookFn<any>[];
};

const toArray = <T>(v: T | T[] | undefined): T[] => {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
};

const normalizeHooks = (hooks: AnyHooks | undefined): NormalizedHooks => ({
  onBeforeSend: toArray(hooks?.onBeforeSend),
  onExecute: toArray(hooks?.onExecute),
  onAfterSend: toArray(hooks?.onAfterSend),
  onError: toArray(hooks?.onError),
});
```

- [ ] **Step 2: Replace `fireHookSafe` with multi-handler runner**

Find the existing `fireHookSafe` (currently lines 108–112) and replace with two helpers:

```ts
const runHooks = async <T>(
  handlers: HookFn<any>[],
  params: T,
  onHookFailure: (err: Error) => Promise<void>,
): Promise<void> => {
  for (const fn of handlers) {
    const [, err] = await handlePromise(Promise.resolve(fn(params)));
    if (err) await onHookFailure(err);
  }
};

const reportHookError = async (
  hookErrorHandlers: HookFn<any>[],
  baseCtx: Record<string, unknown>,
  err: Error,
): Promise<void> => {
  console.error('[emailrpc] hook error:', err);
  const errorParams = {
    ...baseCtx,
    error: err instanceof EmailRpcError
      ? err
      : new EmailRpcError({ message: err.message, code: 'UNKNOWN', cause: err }),
    phase: 'hook' as const,
  };
  for (const fn of hookErrorHandlers) {
    const [, nestedErr] = await handlePromise(Promise.resolve(fn(errorParams)));
    if (nestedErr) console.error('[emailrpc] onError handler also failed:', nestedErr);
  }
};
```

`reportHookError` implements §5.4 — log, then re-emit through `onError` once. Errors from `onError` handlers themselves only `console.error` (no re-recursion).

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: PASS — these helpers aren't called yet.

- [ ] **Checkpoint:** Helpers exist; `executeSend` still uses old single-fn pattern, replaced in Task 9.

---

## Task 7: Onion middleware executor

**Files:**
- Modify: `packages/core/src/client.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/client.test.ts` (in a new `describe` block):

```ts
import type { Middleware } from './middleware.js';

describe('client middleware (onion)', () => {
  it('runs middleware in onion order', async () => {
    const calls: string[] = [];
    const mw1: Middleware = async ({ next }) => {
      calls.push('mw1 enter');
      const r = await next();
      calls.push('mw1 exit');
      return r;
    };
    const mw2: Middleware = async ({ next }) => {
      calls.push('mw2 enter');
      const r = await next();
      calls.push('mw2 exit');
      return r;
    };

    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(mw1)
        .use(mw2)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });

    expect(calls).toEqual(['mw1 enter', 'mw2 enter', 'mw2 exit', 'mw1 exit']);
  });

  it('short-circuit middleware skips render and provider.send', async () => {
    const provider = mockProvider();
    const shortCircuit: Middleware = async () => ({
      messageId: 'fake',
      accepted: [],
      rejected: ['x@y.com'],
      envelope: { from: 'a@b.com', to: ['x@y.com'] },
      timing: { renderMs: 0, sendMs: 0 },
    });

    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(shortCircuit)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({
          render: async () => {
            throw new Error('should not render');
          },
        }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    const result = await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(result.rejected).toEqual(['x@y.com']);
    expect(provider.sent).toEqual([]);
  });

  it('middleware can mutate ctx visible to downstream middleware', async () => {
    let observed: unknown;
    const setMw: Middleware = async ({ next }) => next({ tenantId: 'acme' });
    const readMw: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };

    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(setMw)
        .use(readMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(observed).toMatchObject({ tenantId: 'acme' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/client.test.ts -t "client middleware"`
Expected: FAIL — middleware is not being executed; calls remain empty.

- [ ] **Step 3: Implement the onion executor**

In `packages/core/src/client.ts`, find `executeSend` (currently starting around line 142). Replace its body wholesale. Below is the new, complete implementation. Keep the existing `executeRender`, `normalizeAddress`, `resolveSubject`, `toAddressArray` helpers above it.

```ts
type SendCore = (currentCtx: unknown) => Promise<SendResult>;

const buildMessage = (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  args: RawSendArgs,
  input: unknown,
  rendered: { html: string; text?: string; subject?: string },
  ctx: SendPipelineContext,
  messageId: string,
): RenderedMessage => {
  const subject = resolveSubject(def.subject, input, rendered.subject);
  const fromAddr = def.from ?? ctx.defaults?.from;
  if (!fromAddr) {
    throw new EmailRpcError({
      message: `No "from" address for route "${ctx.route}": set it on the email definition or in client defaults.`,
      code: 'VALIDATION',
      route: ctx.route,
      messageId,
    });
  }
  const toAddresses = toAddressArray(args.to);
  const message: RenderedMessage = {
    from: fromAddr,
    to: toAddresses,
    subject,
    html: rendered.html,
    text: rendered.text ?? '',
    headers: { ...ctx.defaults?.headers, ...args.headers },
    attachments: args.attachments ?? [],
    inlineAssets: {},
  };
  if (args.cc) message.cc = toAddressArray(args.cc);
  if (args.bcc) message.bcc = toAddressArray(args.bcc);
  const replyTo = args.replyTo ?? def.replyTo ?? ctx.defaults?.replyTo;
  if (replyTo) message.replyTo = replyTo;
  if (def.tags) {
    for (const [k, v] of Object.entries(def.tags)) {
      message.headers[`X-EmailRpc-Tag-${k}`] = String(v);
    }
  }
  return message;
};

const composeMiddleware = (
  middlewares: ReadonlyArray<AnyMiddleware>,
  core: SendCore,
  baseInput: unknown,
  baseCtx: unknown,
  route: string,
): ((ctx: unknown) => Promise<SendResult>) => {
  let chain: (ctx: unknown) => Promise<SendResult> = (ctx) => core(ctx);
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const mw = middlewares[i]!;
    const downstream = chain;
    chain = (currentCtx) =>
      mw({
        input: baseInput,
        ctx: currentCtx,
        route,
        next: (newCtx) => downstream(newCtx ? { ...(currentCtx as object), ...newCtx } : currentCtx),
      });
  }
  return (ctx) => chain(ctx);
};
```

Add `AnyMiddleware` to imports:

```ts
import type { AnyMiddleware } from './middleware.js';
```

Now rewrite `executeSend` to use it. Replace the entire `executeSend` function with:

```ts
const executeSend = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  args: RawSendArgs,
  opts: { provider?: string } | undefined,
  ctx: SendPipelineContext,
): Promise<SendResult> => {
  const messageId = crypto.randomUUID();
  const initialCtx: Record<string, unknown> = {};
  const baseHookCtx = { route: ctx.route, args, ctx: initialCtx, messageId };

  const [input, validateErr] = await handlePromise(
    validate(def.schema, args.input, { route: ctx.route }),
  );
  if (validateErr) {
    await runHooks(
      ctx.normalizedHooks.onError,
      { ...baseHookCtx, input: undefined, error: validateErr as EmailRpcError, phase: 'validate' as const },
      (e) => reportHookError(ctx.normalizedHooks.onError, baseHookCtx, e),
    );
    throw validateErr;
  }

  const beforeSendParams = { ...baseHookCtx, input };
  const [, beforeErr] = await handlePromise(
    runHooks(ctx.normalizedHooks.onBeforeSend, beforeSendParams, (e) =>
      reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e),
    ),
  );
  if (beforeErr) throw beforeErr;

  const renderState: { rendered?: { html: string; text?: string; subject?: string }; renderMs: number; sendMs: number } = {
    renderMs: 0,
    sendMs: 0,
  };

  const core: SendCore = async (currentCtx) => {
    const renderStart = performance.now();
    const [rendered, renderErr] = await handlePromise(def.template.render(input));
    renderState.renderMs = performance.now() - renderStart;
    if (renderErr) {
      const wrapped = new EmailRpcError({
        message: `Render failed for route "${ctx.route}": ${renderErr.message}`,
        code: 'RENDER',
        route: ctx.route,
        messageId,
        cause: renderErr,
      });
      await runHooks(
        ctx.normalizedHooks.onError,
        { ...beforeSendParams, ctx: currentCtx, error: wrapped, phase: 'render' as const },
        (e) => reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e),
      );
      throw wrapped;
    }
    renderState.rendered = rendered!;

    const message = buildMessage(def, args, input, rendered!, ctx, messageId);

    const executeParams = { ...beforeSendParams, ctx: currentCtx, rendered: message };
    const [, executeErr] = await handlePromise(
      runHooks(ctx.normalizedHooks.onExecute, executeParams, (e) =>
        reportHookError(ctx.normalizedHooks.onError, executeParams, e),
      ),
    );
    if (executeErr) throw executeErr;

    const provider = pickProvider(ctx, opts, messageId);
    const sendContext: SendContext = { route: ctx.route, messageId, attempt: 1 };
    const sendStart = performance.now();
    const [providerResult, sendErr] = await handlePromise(provider.send(message, sendContext));
    renderState.sendMs = performance.now() - sendStart;

    if (sendErr) {
      const wrapped =
        sendErr instanceof EmailRpcError
          ? sendErr
          : new EmailRpcError({
              message: `Provider send failed for route "${ctx.route}": ${sendErr.message}`,
              code: 'PROVIDER',
              route: ctx.route,
              messageId,
              cause: sendErr,
            });
      await runHooks(
        ctx.normalizedHooks.onError,
        { ...executeParams, error: wrapped, phase: 'send' as const },
        (e) => reportHookError(ctx.normalizedHooks.onError, executeParams, e),
      );
      throw wrapped;
    }

    const fromAddr = message.from;
    return {
      messageId,
      providerMessageId: providerResult!.providerMessageId,
      accepted: providerResult!.accepted,
      rejected: providerResult!.rejected,
      envelope: {
        from: normalizeAddress(fromAddr),
        to: message.to.map(normalizeAddress),
      },
      timing: { renderMs: renderState.renderMs, sendMs: renderState.sendMs },
    };
  };

  const allMiddleware = [...ctx.pluginMiddleware, ...def.middleware];
  const composed = composeMiddleware(allMiddleware, core, input, initialCtx, ctx.route);

  const [result, mwErr] = await handlePromise(composed(initialCtx));
  if (mwErr) {
    const wrapped =
      mwErr instanceof EmailRpcError
        ? mwErr
        : new EmailRpcError({
            message: `Middleware failed for route "${ctx.route}": ${mwErr.message}`,
            code: 'UNKNOWN',
            route: ctx.route,
            messageId,
            cause: mwErr,
          });
    if (wrapped.code !== 'RENDER' && wrapped.code !== 'PROVIDER') {
      await runHooks(
        ctx.normalizedHooks.onError,
        { ...beforeSendParams, error: wrapped, phase: 'middleware' as const },
        (e) => reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e),
      );
    }
    throw wrapped;
  }

  const afterSendParams = { ...beforeSendParams, result: result!, durationMs: renderState.renderMs + renderState.sendMs };
  await runHooks(ctx.normalizedHooks.onAfterSend, afterSendParams, (e) =>
    reportHookError(ctx.normalizedHooks.onError, afterSendParams, e),
  );

  return result!;
};

const pickProvider = (
  ctx: SendPipelineContext,
  opts: { provider?: string } | undefined,
  messageId: string,
): Provider => {
  if (opts?.provider) {
    const found = ctx.providersByName.get(opts.provider);
    if (!found) {
      throw new EmailRpcError({
        message: `Provider "${opts.provider}" is not registered.`,
        code: 'PROVIDER',
        route: ctx.route,
        messageId,
      });
    }
    return found;
  }
  if (!ctx.defaultProvider) {
    throw new EmailRpcError({
      message: 'No providers registered.',
      code: 'PROVIDER',
      route: ctx.route,
      messageId,
    });
  }
  return ctx.defaultProvider.provider;
};
```

- [ ] **Step 4: Update `SendPipelineContext`**

Find `SendPipelineContext` (currently lines 100–106) and replace:

```ts
type SendPipelineContext = {
  providersByName: Map<string, Provider>;
  defaultProvider: ProviderEntry | undefined;
  defaults?: CreateClientOptions<AnyEmailRouter, readonly ProviderEntry[]>['defaults'];
  normalizedHooks: NormalizedHooks;
  pluginMiddleware: ReadonlyArray<AnyMiddleware>;
  route: string;
};
```

- [ ] **Step 5: Update `createClient` to build the new context**

Find `createClient` (currently lines 317–355). Replace its body:

```ts
export const createClient = <R extends AnyEmailRouter, const P extends readonly ProviderEntry[]>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P> & { close: () => Promise<void> } => {
  const { router, providers } = options;
  const cache = new Map<string, unknown>();

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
  const defaultProvider = sortedProviders[0];
  const providersByName = new Map(providers.map((p) => [p.name, p.provider]));

  const plugins = options.plugins ?? [];
  const pluginMiddleware: AnyMiddleware[] = plugins.flatMap((p) => p.middleware ?? []);

  const mergedHooks: AnyHooks = {
    onBeforeSend: [
      ...plugins.flatMap((p) => toArray(p.hooks?.onBeforeSend as HookFn<any> | HookFn<any>[] | undefined)),
      ...toArray(options.hooks?.onBeforeSend as HookFn<any> | HookFn<any>[] | undefined),
    ],
    onExecute: [
      ...plugins.flatMap((p) => toArray(p.hooks?.onExecute as HookFn<any> | HookFn<any>[] | undefined)),
      ...toArray(options.hooks?.onExecute as HookFn<any> | HookFn<any>[] | undefined),
    ],
    onAfterSend: [
      ...plugins.flatMap((p) => toArray(p.hooks?.onAfterSend as HookFn<any> | HookFn<any>[] | undefined)),
      ...toArray(options.hooks?.onAfterSend as HookFn<any> | HookFn<any>[] | undefined),
    ],
    onError: [
      ...plugins.flatMap((p) => toArray(p.hooks?.onError as HookFn<any> | HookFn<any>[] | undefined)),
      ...toArray(options.hooks?.onError as HookFn<any> | HookFn<any>[] | undefined),
    ],
  };
  const normalizedHooks = normalizeHooks(mergedHooks);

  for (const plugin of plugins) {
    if (plugin.onCreate) {
      const maybe = plugin.onCreate({ router });
      if (maybe instanceof Promise) {
        throw new EmailRpcError({
          message: `Plugin "${plugin.name}".onCreate returned a Promise; createClient does not yet support async onCreate.`,
          code: 'UNKNOWN',
        });
      }
    }
  }

  const close = async (): Promise<void> => {
    for (let i = plugins.length - 1; i >= 0; i--) {
      const plugin = plugins[i]!;
      if (plugin.onClose) {
        const [, err] = await handlePromise(Promise.resolve(plugin.onClose()));
        if (err) console.error(`[emailrpc] plugin "${plugin.name}".onClose failed:`, err);
      }
    }
  };

  const proxy = new Proxy({} as EmailClient<R, P>, {
    get(_target, key: string) {
      if (typeof key !== 'string') return undefined;

      const def = (router.emails as Record<string, unknown>)[key] as
        | EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>
        | undefined;
      if (!def) return undefined;

      if (cache.has(key)) return cache.get(key);

      const methods = Object.freeze({
        send: (sendArgs: RawSendArgs, sendOpts?: { provider?: string }) =>
          executeSend(def, sendArgs, sendOpts, {
            providersByName,
            defaultProvider,
            defaults: options.defaults,
            normalizedHooks,
            pluginMiddleware,
            route: key,
          }),
        render: (input: unknown, renderOpts?: RenderOptions) =>
          executeRender(def, input, renderOpts),
      });

      cache.set(key, methods);
      return methods;
    },
  });

  return Object.assign(proxy, { close }) as EmailClient<R, P> & { close: () => Promise<void> };
};
```

Note the synchronous `onCreate` constraint: deferring async-onCreate to a later cycle keeps `createClient` synchronous (existing tests rely on this). If a plugin needs async setup, the design path is `await plugin.init()` in user code before `createClient`.

- [ ] **Step 6: Run middleware tests**

Run: `pnpm --filter @emailrpc/core exec vitest run src/client.test.ts -t "client middleware"`
Expected: PASS.

- [ ] **Step 7: Run full client test suite**

Run: `pnpm --filter @emailrpc/core exec vitest run src/client.test.ts`
Expected: PASS — including the existing hook tests, which still use the single-fn shape.

- [ ] **Checkpoint:** Onion executor live; existing hooks still work; new middleware tests pass.

---

## Task 8: `onExecute` hook tests

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Add tests**

Add to `packages/core/src/client.test.ts` inside `describe('client hooks', ...)`:

```ts
it('fires onExecute with the rendered message', async () => {
  const router = createTestRouter();
  let captured: { subject: string; html: string } | undefined;
  const mail = createClient({
    router,
    providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    defaults: { from: 'a@b.com' },
    hooks: {
      onExecute: ({ rendered }) => {
        captured = { subject: rendered.subject, html: rendered.html };
      },
    },
  });
  await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
  expect(captured?.subject).toBe('Welcome, Lucas!');
});

it('throw in onBeforeSend aborts the send and re-emits via onError(phase: hook)', async () => {
  const router = createTestRouter();
  const provider = mockProvider();
  const errors: Array<{ phase: string }> = [];
  const mail = createClient({
    router,
    providers: [{ name: 'mock', provider, priority: 1 }],
    defaults: { from: 'a@b.com' },
    hooks: {
      onBeforeSend: () => {
        throw new Error('hook abort');
      },
      onError: ({ phase }) => {
        errors.push({ phase });
      },
    },
  });
  await expect(
    mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } }),
  ).rejects.toThrow('hook abort');
  expect(provider.sent).toEqual([]);
  expect(errors).toEqual([{ phase: 'hook' }]);
});

it('multi-hook registration runs all in order', async () => {
  const router = createTestRouter();
  const calls: string[] = [];
  const mail = createClient({
    router,
    providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    defaults: { from: 'a@b.com' },
    hooks: {
      onAfterSend: [
        () => { calls.push('a'); },
        () => { calls.push('b'); },
        () => { calls.push('c'); },
      ],
    },
  });
  await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
  expect(calls).toEqual(['a', 'b', 'c']);
});

it('a thrown hook in the middle of onAfterSend does not stop subsequent hooks', async () => {
  const router = createTestRouter();
  const calls: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const mail = createClient({
    router,
    providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    defaults: { from: 'a@b.com' },
    hooks: {
      onAfterSend: [
        () => { calls.push('a'); },
        () => { throw new Error('boom'); },
        () => { calls.push('c'); },
      ],
    },
  });
  await mail.welcome.send({ to: 'lucas@x.com', input: { name: 'Lucas' } });
  expect(calls).toEqual(['a', 'c']);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run the new tests**

Run: `pnpm --filter @emailrpc/core exec vitest run src/client.test.ts -t "client hooks"`
Expected: PASS — onExecute already implemented in Task 7, multi-hook + abort behavior already implemented.

- [ ] **Checkpoint:** New hook capabilities verified by tests.

---

## Task 9: Plugin lifecycle tests

**Files:**
- Modify: `packages/core/src/plugin.test.ts`

- [ ] **Step 1: Add lifecycle tests**

Append to `packages/core/src/plugin.test.ts`:

```ts
import { z } from 'zod';
import { createClient } from './client.js';
import { emailRpc } from './init.js';
import { mockProvider } from './test.js';

const makeRouter = () => {
  const t = emailRpc.init();
  return t.router({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) }),
  });
};

describe('plugin lifecycle', () => {
  it('runs onCreate in array order at createClient time', () => {
    const order: string[] = [];
    const a: Plugin = { name: 'a', onCreate: () => { order.push('a'); } };
    const b: Plugin = { name: 'b', onCreate: () => { order.push('b'); } };
    createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [a, b],
    });
    expect(order).toEqual(['a', 'b']);
  });

  it('runs onClose in REVERSE order on mail.close()', async () => {
    const order: string[] = [];
    const a: Plugin = { name: 'a', onClose: () => { order.push('a'); } };
    const b: Plugin = { name: 'b', onClose: () => { order.push('b'); } };
    const mail = createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [a, b],
    });
    await mail.close();
    expect(order).toEqual(['b', 'a']);
  });

  it('plugin hooks run BEFORE user hooks', async () => {
    const order: string[] = [];
    const plugin: Plugin = {
      name: 'p',
      hooks: { onAfterSend: () => { order.push('plugin'); } },
    };
    const mail = createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [plugin],
      hooks: { onAfterSend: () => { order.push('user'); } },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(order).toEqual(['plugin', 'user']);
  });

  it('plugin middleware wraps route middleware', async () => {
    const order: string[] = [];
    const pluginMw: Middleware = async ({ next }) => {
      order.push('plugin enter');
      const r = await next();
      order.push('plugin exit');
      return r;
    };
    const routeMw: Middleware = async ({ next }) => {
      order.push('route enter');
      const r = await next();
      order.push('route exit');
      return r;
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(routeMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [{ name: 'p', middleware: [pluginMw] }],
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(order).toEqual(['plugin enter', 'route enter', 'route exit', 'plugin exit']);
  });

  it('onCreate failure aborts createClient', () => {
    const failing: Plugin = {
      name: 'failing',
      onCreate: () => { throw new Error('init boom'); },
    };
    expect(() =>
      createClient({
        router: makeRouter(),
        providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
        defaults: { from: 'a@b.com' },
        plugins: [failing],
      }),
    ).toThrow('init boom');
  });
});
```

Add `Middleware` to imports at top:

```ts
import type { Middleware } from './middleware.js';
```

- [ ] **Step 2: Run plugin tests**

Run: `pnpm --filter @emailrpc/core exec vitest run src/plugin.test.ts`
Expected: PASS.

- [ ] **Checkpoint:** Plugin lifecycle and composition verified.

---

## Task 10: Real `loggerMw`

**Files:**
- Modify: `packages/core/src/middleware.ts`
- Modify: `packages/core/src/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Open `packages/core/src/middleware.test.ts`. Replace its contents (it's currently a stub-throws test) with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { loggerMw, dryRunMw, tagInjectMw } from './middleware.js';
import type { Middleware } from './middleware.js';

const noopNext = (override?: unknown) => Promise.resolve({
  messageId: 'm',
  accepted: ['x@y.com'],
  rejected: [],
  envelope: { from: 'a@b.com', to: ['x@y.com'] },
  timing: { renderMs: 0, sendMs: 0 },
});

describe('loggerMw', () => {
  it('logs start and end with route', async () => {
    const log: string[] = [];
    const logger = { info: (msg: string) => log.push(msg), error: () => {} };
    const mw = loggerMw({ logger });
    await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      next: noopNext as never,
    });
    expect(log[0]).toMatch(/welcome/);
    expect(log[1]).toMatch(/welcome/);
  });

  it('uses console as default logger', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mw = loggerMw();
    await mw({ input: {}, ctx: {}, route: 'r', next: noopNext as never });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "loggerMw"`
Expected: FAIL — `loggerMw` throws `EmailRpcNotImplementedError`.

- [ ] **Step 3: Implement `loggerMw`**

In `packages/core/src/middleware.ts`, replace the existing `loggerMw` stub:

```ts
export type LoggerLike = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

export type LoggerMwOptions = {
  logger?: LoggerLike;
};

export const loggerMw = (opts: LoggerMwOptions = {}): Middleware => {
  const logger = opts.logger ?? console;
  return async ({ route, next }) => {
    const start = performance.now();
    logger.info(`[email] start route=${route}`);
    const [result, err] = await handlePromise(next());
    const ms = (performance.now() - start).toFixed(1);
    if (err) {
      logger.error(`[email] error route=${route} ms=${ms} ${err.message}`);
      throw err;
    }
    logger.info(`[email] done route=${route} ms=${ms}`);
    return result!;
  };
};
```

Add at top of `middleware.ts`:

```ts
import { handlePromise } from './client.js';
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "loggerMw"`
Expected: PASS.

- [ ] **Checkpoint:** `loggerMw` works and emits start/end logs.

---

## Task 11: Real `dryRunMw`

**Files:**
- Modify: `packages/core/src/middleware.ts`
- Modify: `packages/core/src/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/middleware.test.ts`:

```ts
describe('dryRunMw', () => {
  it('short-circuits without calling next', async () => {
    const mw = dryRunMw();
    let called = false;
    const r = await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      next: (() => {
        called = true;
        return noopNext();
      }) as never,
    });
    expect(called).toBe(false);
    expect(r.messageId).toBe('dry-run');
    expect(r.accepted).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "dryRunMw"`
Expected: FAIL.

- [ ] **Step 3: Implement `dryRunMw`**

Replace the `dryRunMw` stub in `packages/core/src/middleware.ts`:

```ts
export const dryRunMw = (): Middleware => {
  return async () => ({
    messageId: 'dry-run',
    accepted: [],
    rejected: [],
    envelope: { from: '', to: [] },
    timing: { renderMs: 0, sendMs: 0 },
  });
};
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "dryRunMw"`
Expected: PASS.

- [ ] **Checkpoint:** `dryRunMw` short-circuits.

---

## Task 12: Real `tagInjectMw`

**Files:**
- Modify: `packages/core/src/middleware.ts`
- Modify: `packages/core/src/middleware.test.ts`

`tagInjectMw` resolves the §10 open question by mutating `ctx.headers` — we change ctx to carry a `headers` accumulator that the renderer reads. For this push, the simpler approach is to short-circuit-free and let the user wire headers via per-call args. Keep the stub behavior: middleware that exposes a tag map but doesn't mutate the outgoing message in this push (tagged for follow-up).

Decision for this push: **`tagInjectMw` mutates the incoming `ctx` with a `tagsToInject` field**, and the rendered message picks it up only when the user reads it back. Since no consumer reads `ctx.tagsToInject` yet, this middleware effectively no-ops outgoing headers — which is acceptable. The middleware exists to validate the API shape and unblock the test surface.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/middleware.test.ts`:

```ts
describe('tagInjectMw', () => {
  it('exposes injected tags via ctx', async () => {
    let observed: unknown;
    const mw = tagInjectMw({ tags: { env: 'prod', region: 'eu' } });
    const downstream: Middleware = async ({ ctx, next }) => {
      observed = ctx;
      return next();
    };
    const result = await mw({
      input: {},
      ctx: {},
      route: 'r',
      next: ((newCtx?: object) => {
        return downstream({
          input: {},
          ctx: { ...(newCtx ?? {}) },
          route: 'r',
          next: noopNext as never,
        });
      }) as never,
    });
    expect(observed).toMatchObject({ tagsToInject: { env: 'prod', region: 'eu' } });
    expect(result.accepted).toEqual(['x@y.com']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "tagInjectMw"`
Expected: FAIL.

- [ ] **Step 3: Implement `tagInjectMw`**

Replace the `tagInjectMw` stub in `packages/core/src/middleware.ts`:

```ts
export type TagInjectMwOptions = {
  tags: Record<string, string>;
};

export const tagInjectMw = (opts: TagInjectMwOptions): Middleware => {
  return async ({ next }) => next({ tagsToInject: opts.tags } as never);
};
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @emailrpc/core exec vitest run src/middleware.test.ts -t "tagInjectMw"`
Expected: PASS.

- [ ] **Checkpoint:** `tagInjectMw` injects via ctx. (Reader-side wiring is part of a future cycle; tracked as an open question in the design doc §10.)

---

## Task 13: `loggerPlugin`

**Files:**
- Create: `packages/core/src/plugins/logger.ts`
- Modify: `packages/core/src/plugin.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/plugin.test.ts`:

```ts
import { loggerPlugin } from './plugins/logger.js';

describe('loggerPlugin', () => {
  it('logs onAfterSend with route + duration', async () => {
    const log: string[] = [];
    const logger = { info: (m: string) => log.push(m), error: () => {} };
    const mail = createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [loggerPlugin({ logger })],
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(log.some((l) => /welcome/.test(l) && /ms/.test(l))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/plugin.test.ts -t "loggerPlugin"`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the plugin**

Create `packages/core/src/plugins/logger.ts`:

```ts
import type { Plugin } from '../plugin.js';
import type { LoggerLike } from '../middleware.js';

export type LoggerPluginOptions = {
  logger?: LoggerLike;
};

export const loggerPlugin = (opts: LoggerPluginOptions = {}): Plugin => {
  const logger = opts.logger ?? console;
  return {
    name: 'logger',
    hooks: {
      onBeforeSend: ({ route, messageId }) =>
        logger.info(`[email] start route=${route} id=${messageId}`),
      onAfterSend: ({ route, messageId, durationMs }) =>
        logger.info(`[email] done route=${route} id=${messageId} ms=${durationMs.toFixed(1)}`),
      onError: ({ route, messageId, phase, error }) =>
        logger.error(`[email] fail route=${route} id=${messageId} phase=${phase} ${error.message}`),
    },
  };
};
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @emailrpc/core exec vitest run src/plugin.test.ts -t "loggerPlugin"`
Expected: PASS.

- [ ] **Checkpoint:** First built-in plugin shipped.

---

## Task 14: Update `index.ts` exports

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add new exports**

In `packages/core/src/index.ts`, add the following lines (preserve existing exports):

```ts
export type {
  Plugin,
} from './plugin.js';

export {
  loggerMw,
  dryRunMw,
  tagInjectMw,
} from './middleware.js';
export type {
  Middleware,
  AnyMiddleware,
  MiddlewareParams,
  LoggerMwOptions,
  TagInjectMwOptions,
  LoggerLike,
} from './middleware.js';

export { loggerPlugin } from './plugins/logger.js';
export type { LoggerPluginOptions } from './plugins/logger.js';
```

Inside the existing `client.js` re-export block, add the new types:

```ts
export type {
  ProviderEntry,
  ClientHooks,
  CreateClientOptions,
  SendOptions,
  SendArgs,
  RenderOptions,
  EmailClient,
  HookFn,
  RouteUnion,
  BeforeSendCtx,
  ExecuteCtx,
  AfterSendCtx,
  ErrorCtx,
  ErrorPhase,
} from './client.js';
```

Remove the existing line that exports `InitHooks` from `init.js` (no longer exists):

```ts
export type { RootBuilder, InitOptions, EmailRpc } from './init.js';
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `pnpm --filter @emailrpc/core test`
Expected: PASS.

- [ ] **Checkpoint:** All new types/values exported.

---

## Task 15: Subpath export for `./middleware`

**Files:**
- Modify: `packages/core/package.json`

Spec §3.3 lists `./middleware` as a subpath export. Today the package.json may already have it; verify and/or add.

- [ ] **Step 1: Inspect**

Run: `cat packages/core/package.json | grep -A 1 middleware`
Expected: `"./middleware":` line present pointing to `./dist/middleware.js`. If present and correct, mark Task 15 complete.

If absent, add to the `exports` map in `packages/core/package.json`:

```jsonc
"./middleware": { "import": "./dist/middleware.js", "types": "./dist/middleware.d.ts" }
```

- [ ] **Step 2: Build and verify**

Run: `pnpm --filter @emailrpc/core build`
Expected: PASS, produces `dist/middleware.js` and `dist/middleware.d.ts`.

- [ ] **Checkpoint:** Subpath export works.

---

## Task 16: Repo-wide CI

**Files:**
- None modified — verification only.

- [ ] **Step 1: Run repo-level CI**

Run from repo root: `pnpm ci`
Expected: PASS — `build typecheck test lint` across all workspace packages.

- [ ] **Step 2: If any examples break**

The example in `examples/welcome-text` may import `InitHooks` or pass `{ hooks }` to `init()`. If the build fails there, open the example's source and remove the `hooks` argument or `InitHooks` import. The example's intended behavior (mocked send) should not change.

- [ ] **Checkpoint:** Repo green. Implementation done.

---

## Acceptance criteria — final verification

- `pnpm ci` green from repo root.
- New tests in `client.test.ts`, `builder.test.ts`, `middleware.test.ts`, `plugin.test.ts` pass.
- Manual smoke: a small inline `createClient({ plugins: [loggerPlugin()] })` example sends through `mockProvider` and prints start/done logs.
- Spec §7 execution order observable via the multi-hook ordering tests in Task 8 + the onion test in Task 7.

## Out-of-scope reminders (do NOT implement here)

- `mail.<route>.queue(...)`, queue adapter, worker.
- Stateful middleware (`suppressionListMw`, `rateLimitMw`, `idempotencyMw`).
- OTel plugin.
- React Email / MJML / Handlebars adapters.
- Real `smtp` / `ses` / `resend` providers.
- Plugin-contributed client methods (e.g. plugin adds `.queue()`).
- `attempt` / `via` hook fields.
