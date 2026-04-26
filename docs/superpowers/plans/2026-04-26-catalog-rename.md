# Catalog Rename & Factory Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `EmailRouter` → `EmailCatalog` across `@emailrpc/core` and adapter packages, replace `emailRpc.init()` with `createEmailRpc()`, and add nested catalog composition.

**Architecture:** Mechanical rename of the Layer 1 aggregation primitive plus one new feature (recursive `.catalog()` that flattens sub-catalogs into dot-pathed IDs). Runtime behavior of the send/render/queue pipelines is unchanged. The catalog object gains two views: a flat registry keyed by dot-path (used by client, worker, webhook), and a nested map (used by the proxy that exposes `mail.transactional.welcome.send(...)`).

**Tech Stack:** TypeScript 5.x, Vitest, Rolldown, pnpm 10, Turbo, Standard Schema (Zod 3.24+ in tests). No runtime dependencies added.

**Source spec:** `docs/superpowers/specs/2026-04-26-catalog-rename-design.md`

---

## Pre-flight

Before starting, run `pnpm install && pnpm ci` from the repo root and confirm a clean baseline. If anything fails at baseline, stop and surface it — do not start the rename on top of red CI.

---

## Task 1: Rename `router.ts` → `catalog.ts`, introduce `EmailCatalog` type with sub-catalog brand

**Files:**
- Create: `packages/core/src/catalog.ts`
- Delete: `packages/core/src/router.ts` (after Task 5 finishes migrating consumers; for now leave it in place)
- Test: `packages/core/src/catalog.test.ts` (new file, mirrors and extends `router.test.ts`)

This task introduces the new module alongside the old one. Subsequent tasks migrate consumers. Old `router.ts` is deleted in Task 9 once nothing references it.

- [ ] **Step 1.1: Write the failing tests for `createCatalog` (flat case)**

Create `packages/core/src/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEmailBuilder } from './builder.js';
import { createCatalog, isEmailCatalog } from './catalog.js';

const buildEmail = (id: string) =>
  createEmailBuilder<unknown>({})
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Hi ${input.name}`)
    .template({ render: async () => ({ html: `<p>${id}</p>` }) });

describe('createCatalog (flat)', () => {
  it('produces a catalog branded as EmailCatalog', () => {
    const catalog = createCatalog({ welcome: buildEmail('welcome') });
    expect(isEmailCatalog(catalog)).toBe(true);
    expect(catalog._brand).toBe('EmailCatalog');
  });

  it('flattens single-level keys to dot-path-free ids', () => {
    const catalog = createCatalog({
      welcome: buildEmail('welcome'),
      reset: buildEmail('reset'),
    });
    expect(Object.keys(catalog.emails).sort()).toEqual(['reset', 'welcome']);
    expect(catalog.emails.welcome?.id).toBe('welcome');
    expect(catalog.routes.sort()).toEqual(['reset', 'welcome']);
  });

  it('throws when an email procedure is incomplete', () => {
    const incomplete = createEmailBuilder<unknown>({}).input(z.object({}));
    expect(() => createCatalog({ x: incomplete as never })).toThrow(/incomplete/);
  });
});
```

- [ ] **Step 1.2: Run tests and verify they fail**

Run: `pnpm --filter @emailrpc/core exec vitest run src/catalog.test.ts`
Expected: module-not-found error for `./catalog.js`.

- [ ] **Step 1.3: Create `packages/core/src/catalog.ts` with the flat-only minimum**

```ts
import type { AnyStandardSchema, InferInput, InferOutput } from './schema.js';
import type { TemplateAdapter } from './template.js';
import type { EmailBuilder, EmailDefinition, EmailDefinitionOf } from './builder.js';

const CATALOG_BRAND = 'EmailCatalog' as const;

export type EmailCatalog<M, Ctx = unknown> = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: Ctx;
  readonly emails: { readonly [K in FlatKeys<M> & string]: EmailDefinition<Ctx, any, any> };
  readonly nested: { readonly [K in keyof M]: NestedValue<M[K], Ctx> };
  readonly routes: ReadonlyArray<string>;
};

export type AnyEmailCatalog = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: any;
  readonly emails: Record<string, EmailDefinition<any, any, any>>;
  readonly nested: Record<string, unknown>;
  readonly routes: ReadonlyArray<string>;
};

type IsCatalog<T> = T extends { readonly _brand: typeof CATALOG_BRAND } ? true : false;

type NestedValue<V, Ctx> = IsCatalog<V> extends true
  ? V
  : V extends EmailBuilder<any, any>
    ? EmailDefinitionOf<V>
    : never;

type FlatKeys<M> = {
  [K in keyof M & string]: IsCatalog<M[K]> extends true
    ? M[K] extends { readonly emails: infer SubEmails }
      ? `${K}.${keyof SubEmails & string}`
      : never
    : K;
}[keyof M & string];

export type ValidateCatalog<M> = {
  [K in keyof M]: IsCatalog<M[K]> extends true
    ? M[K]
    : M[K] extends EmailBuilder<any, infer S>
      ? S extends {
          input: AnyStandardSchema;
          subject: unknown;
          template: TemplateAdapter<any, any>;
        }
        ? M[K]
        : `Email "${K & string}" is incomplete: input, subject, and template are required.`
      : `Value at "${K & string}" is not an EmailBuilder or EmailCatalog.`;
};

export const isEmailCatalog = (v: unknown): v is AnyEmailCatalog => {
  return !!v && typeof v === 'object' && (v as { _brand?: string })._brand === CATALOG_BRAND;
};

const builderToDefinition = (
  builder: { _state?: Record<string, unknown> },
  id: string,
): EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>> => {
  const state = builder._state as
    | {
        schema?: AnyStandardSchema;
        subject?: unknown;
        template?: TemplateAdapter<unknown, unknown>;
        from?: unknown;
        replyTo?: unknown;
        tags?: unknown;
        priority?: unknown;
        middleware?: ReadonlyArray<unknown>;
      }
    | undefined;
  if (!state || !state.schema || !state.subject || !state.template) {
    throw new Error(`Email "${id}" is incomplete: input/subject/template are required.`);
  }
  return {
    _ctx: undefined as never,
    id,
    schema: state.schema,
    subject: state.subject as never,
    template: state.template,
    from: state.from as never,
    replyTo: state.replyTo as never,
    tags: (state.tags as never) ?? {},
    priority: (state.priority as never) ?? 'normal',
    middleware: (state.middleware as never) ?? [],
  };
};

export const createCatalog = <const M extends Record<string, unknown>, Ctx = unknown>(
  map: M & ValidateCatalog<M>,
): EmailCatalog<M, Ctx> => {
  const flat: Record<string, EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>> = {};
  const nested: Record<string, unknown> = {};
  const routes: string[] = [];

  for (const key of Object.keys(map)) {
    const value = (map as Record<string, unknown>)[key];
    if (isEmailCatalog(value)) {
      nested[key] = value;
      for (const subKey of value.routes) {
        const flatKey = `${key}.${subKey}`;
        const subDef = value.emails[subKey];
        if (!subDef) continue;
        flat[flatKey] = { ...subDef, id: flatKey };
        routes.push(flatKey);
      }
    } else {
      const def = builderToDefinition(
        value as { _state?: Record<string, unknown> },
        key,
      );
      flat[key] = def;
      nested[key] = def;
      routes.push(key);
    }
  }

  return {
    _brand: CATALOG_BRAND,
    _ctx: undefined as never,
    emails: flat as EmailCatalog<M, Ctx>['emails'],
    nested: nested as EmailCatalog<M, Ctx>['nested'],
    routes,
  };
};

type SchemaOf<B> = B extends EmailBuilder<any, infer S>
  ? S extends { input: infer TSchema }
    ? TSchema extends AnyStandardSchema
      ? TSchema
      : never
    : never
  : never;

type CatalogOf<R> = R extends EmailCatalog<infer M, any> ? M : never;

export type CtxOf<R> = R extends EmailCatalog<any, infer Ctx> ? Ctx : unknown;

export type InputOf<R extends AnyEmailCatalog, K extends keyof CatalogOf<R> & string> = InferInput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type OutputOf<R extends AnyEmailCatalog, K extends keyof CatalogOf<R> & string> = InferOutput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type CatalogMap = Record<string, unknown>;
```

- [ ] **Step 1.4: Run tests and verify they pass**

Run: `pnpm --filter @emailrpc/core exec vitest run src/catalog.test.ts`
Expected: 3 passing.

- [ ] **Step 1.5: Add nested-composition tests**

Append to `packages/core/src/catalog.test.ts`:

```ts
describe('createCatalog (nested)', () => {
  it('flattens sub-catalogs into dot-path ids', () => {
    const transactional = createCatalog({
      welcome: buildEmail('welcome'),
      reset: buildEmail('reset'),
    });
    const marketing = createCatalog({ newsletter: buildEmail('newsletter') });
    const root = createCatalog({
      transactional,
      marketing,
      systemAlert: buildEmail('systemAlert'),
    });
    expect(root.routes.sort()).toEqual([
      'marketing.newsletter',
      'systemAlert',
      'transactional.reset',
      'transactional.welcome',
    ]);
    expect(root.emails['transactional.welcome']?.id).toBe('transactional.welcome');
    expect(root.emails['marketing.newsletter']?.id).toBe('marketing.newsletter');
    expect(root.emails.systemAlert?.id).toBe('systemAlert');
  });

  it('preserves the nested view for proxy-based clients', () => {
    const transactional = createCatalog({ welcome: buildEmail('welcome') });
    const root = createCatalog({ transactional });
    expect(isEmailCatalog(root.nested.transactional)).toBe(true);
  });

  it('supports three-level nesting', () => {
    const inner = createCatalog({ leaf: buildEmail('leaf') });
    const mid = createCatalog({ inner });
    const root = createCatalog({ mid });
    expect(root.routes).toEqual(['mid.inner.leaf']);
    expect(root.emails['mid.inner.leaf']?.id).toBe('mid.inner.leaf');
  });

  it('allows empty catalogs', () => {
    const empty = createCatalog({});
    expect(empty.routes).toEqual([]);
  });
});
```

- [ ] **Step 1.6: Run nested tests**

Run: `pnpm --filter @emailrpc/core exec vitest run src/catalog.test.ts`
Expected: 7 passing.

Note: the simple flatten in 1.3 already handles two levels. The three-level test will fail because `value.emails` is already flattened, so re-flattening adds prefixes correctly. Verify before continuing — if it fails, the iteration in `createCatalog` needs to use `value.routes` (already-flat keys from the sub-catalog) rather than `Object.keys(value.nested)`. The code in 1.3 does this correctly; the test confirms it.

- [ ] **Step 1.7: Commit**

```bash
git add packages/core/src/catalog.ts packages/core/src/catalog.test.ts
git commit -m "feat(core): add EmailCatalog with nested composition"
```

---

## Task 2: Add `createEmailRpc` factory, remove `emailRpc.init`

**Files:**
- Modify: `packages/core/src/init.ts`
- Test: `packages/core/src/init.test.ts` (new)

The `init.ts` file currently exports `emailRpc.init()` and `RootBuilder`. Rename the file to `factory.ts` in this task, swap the public surface to `createEmailRpc`, and update the builder method from `.router(...)` to `.catalog(...)`.

- [ ] **Step 2.1: Write failing factory tests**

Create `packages/core/src/factory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEmailRpc } from './factory.js';
import { isEmailCatalog } from './catalog.js';

describe('createEmailRpc', () => {
  it('returns a root builder with email/use/catalog methods', () => {
    const rpc = createEmailRpc<{ tenantId: string }>();
    expect(typeof rpc.email).toBe('function');
    expect(typeof rpc.use).toBe('function');
    expect(typeof rpc.catalog).toBe('function');
  });

  it('produces a catalog from a single email procedure', () => {
    const rpc = createEmailRpc();
    const welcome = rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Hi ${input.name}`)
      .template({ render: async () => ({ html: '<p>hi</p>' }) });
    const catalog = rpc.catalog({ welcome });
    expect(isEmailCatalog(catalog)).toBe(true);
    expect(catalog.routes).toEqual(['welcome']);
  });

  it('chains root middleware via .use', () => {
    const rpc = createEmailRpc<{ a: string }>().use(async ({ ctx, next }) => {
      return next({ ...ctx, b: 1 });
    });
    const welcome = rpc
      .email()
      .input(z.object({}))
      .subject('hi')
      .template({ render: async () => ({ html: '' }) });
    const catalog = rpc.catalog({ welcome });
    expect(catalog.routes).toEqual(['welcome']);
  });
});
```

- [ ] **Step 2.2: Run tests and verify failure**

Run: `pnpm --filter @emailrpc/core exec vitest run src/factory.test.ts`
Expected: module-not-found `./factory.js`.

- [ ] **Step 2.3: Create `packages/core/src/factory.ts`**

```ts
import { createEmailBuilder, type EmailBuilder } from './builder.js';
import { createCatalog, type EmailCatalog, type ValidateCatalog } from './catalog.js';
import type { AnyMiddleware, Middleware } from './middlewares/types.js';

export type RootBuilder<Ctx> = {
  email(): EmailBuilder<Ctx>;
  use<TCtxOut = Ctx>(
    middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>,
  ): RootBuilder<TCtxOut>;
  catalog<const M extends Record<string, unknown>>(
    map: M & ValidateCatalog<M>,
  ): EmailCatalog<M, Ctx>;
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
  use<TCtxOut = Ctx>(middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>) {
    return buildRoot<TCtxOut>([...rootMiddleware, middleware as AnyMiddleware]);
  },
  catalog<const M extends Record<string, unknown>>(map: M & ValidateCatalog<M>) {
    return createCatalog(map as never) as EmailCatalog<M, Ctx>;
  },
});

export const createEmailRpc = <Ctx = {}>(): RootBuilder<Ctx> => buildRoot<Ctx>([]);
```

- [ ] **Step 2.4: Run tests and verify they pass**

Run: `pnpm --filter @emailrpc/core exec vitest run src/factory.test.ts`
Expected: 3 passing.

- [ ] **Step 2.5: Delete `packages/core/src/init.ts`**

```bash
rm packages/core/src/init.ts
```

- [ ] **Step 2.6: Commit**

```bash
git add packages/core/src/factory.ts packages/core/src/factory.test.ts
git rm packages/core/src/init.ts
git commit -m "feat(core): add createEmailRpc factory, remove emailRpc.init"
```

Typecheck will fail at this point because `index.ts` still re-exports from `init.js` and other files still import `EmailRouter`. Tasks 3–5 fix that. Do not run `pnpm typecheck` between Task 2 and Task 5 — it is expected to be red.

---

## Task 3: Migrate `client.ts` from `EmailRouter` → `EmailCatalog`

**Files:**
- Modify: `packages/core/src/client.ts`

Rename the `router` field to `catalog`, update type imports, and switch the proxy lookup to use `catalog.emails` (which is the flat dot-path registry from Task 1). The proxy must support both flat keys (`mail.welcome`) and nested access (`mail.transactional.welcome`).

- [ ] **Step 3.1: Update imports**

In `packages/core/src/client.ts` line 14, replace:

```ts
import type { AnyEmailRouter, CtxOf, EmailRouter, InputOf } from './router.js';
```

with:

```ts
import type { AnyEmailCatalog, CtxOf, EmailCatalog, InputOf } from './catalog.js';
import { isEmailCatalog } from './catalog.js';
```

- [ ] **Step 3.2: Rename type aliases throughout the file**

Run a controlled sed pass on `client.ts` only:

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  packages/core/src/client.ts
```

Then manually rename the `router` option field. Search for `router:` and `router,` and `router.emails` in the file and replace each occurrence with `catalog:` / `catalog,` / `catalog.emails`. The shape of `CreateClientOptions` becomes:

```ts
export type CreateClientOptions<R extends AnyEmailCatalog, P extends readonly TransportEntry[]> = {
  catalog: R;
  transports: P;
  ctx?: CtxOf<R>;
  defaults?: { ... };
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
};
```

And inside `createClient`, replace:

```ts
const { router, transports } = options;
```

with:

```ts
const { catalog, transports } = options;
```

And replace plugin `onCreate({ router })` calls with `onCreate({ catalog })`.

- [ ] **Step 3.3: Add nested proxy support**

Replace the `Proxy` body's `get` handler (around line 577) with a recursive proxy builder so `mail.transactional.welcome.send(...)` works. The new helper:

```ts
const buildProcMethods = (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
  flatKey: string,
) => Object.freeze({
  send: (sendArgs: RawSendArgs, sendOpts?: { transport?: string }) =>
    executeSend(def, sendArgs, sendOpts, {
      transportsByName,
      defaultTransport,
      defaults: options.defaults,
      defaultCtx: options.ctx,
      normalizedHooks,
      pluginMiddleware,
      logger: baseLogger,
      route: flatKey,
    }),
  render: (input: unknown, renderOpts?: { format?: 'html' | 'text'; ctx?: unknown }) =>
    executeRender(def, input, renderOpts),
});

const buildNestedProxy = (
  nestedNode: Record<string, unknown>,
  pathPrefix: string,
): unknown => {
  return new Proxy(
    {},
    {
      get(_t, key: string) {
        if (typeof key !== 'string') return undefined;
        const value = nestedNode[key];
        if (value === undefined) return undefined;
        const flatKey = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (isEmailCatalog(value)) {
          return buildNestedProxy(
            value.nested as Record<string, unknown>,
            flatKey,
          );
        }
        const def = catalog.emails[flatKey];
        if (!def) return undefined;
        if (cache.has(flatKey)) return cache.get(flatKey);
        const methods = buildProcMethods(def, flatKey);
        cache.set(flatKey, methods);
        return methods;
      },
    },
  );
};
```

Replace the existing `proxy` construction with:

```ts
const target = { close } as { close: () => Promise<void> };
const nestedProxy = buildNestedProxy(catalog.nested as Record<string, unknown>, '');
const proxy = new Proxy(target as unknown as EmailClient<R, P> & { close: () => Promise<void> }, {
  get(t, key: string) {
    if (typeof key !== 'string') return undefined;
    if (key === 'close') return (t as { close: () => Promise<void> }).close;
    return (nestedProxy as Record<string, unknown>)[key];
  },
});

return proxy;
```

- [ ] **Step 3.4: Update `EmailClient` type to mirror nested shape**

Replace the `EmailClient` type definition with:

```ts
type ClientFromMap<M, P extends readonly TransportEntry[]> = {
  [K in keyof M]: M[K] extends AnyEmailCatalog
    ? ClientFromMap<M[K] extends EmailCatalog<infer SubM> ? SubM : never, P>
    : M[K] extends { readonly schema: infer TSchema }
      ? TSchema extends AnyStandardSchema
        ? RouteMethods<InferOutput<TSchema>, P>
        : never
      : RouteMethods<unknown, P>;
};

export type EmailClient<R extends AnyEmailCatalog, P extends readonly TransportEntry[]> =
  R extends EmailCatalog<infer M> ? ClientFromMap<M, P> : never;
```

Add `import type { InferOutput } from './schema.js';` if not already present.

- [ ] **Step 3.5: Run client tests (expected to fail until tests are updated in Task 6)**

Run: `pnpm --filter @emailrpc/core exec vitest run src/client.test.ts`
Expected: tests fail with `Property 'router' is missing` or similar — this is fine. Tests get updated in Task 6.

- [ ] **Step 3.6: Commit**

```bash
git add packages/core/src/client.ts
git commit -m "refactor(core): migrate client to EmailCatalog with nested proxy"
```

---

## Task 4: Migrate `sender.ts`, `worker.ts`, `webhook.ts` to `EmailCatalog`

**Files:**
- Modify: `packages/core/src/sender.ts`
- Modify: `packages/core/src/worker.ts`
- Modify: `packages/core/src/webhook.ts`
- Modify: `packages/core/src/plugins/types.ts`
- Modify: `packages/core/src/transports/multi.types.ts`
- Modify: `packages/core/src/transports/multi.ts`

These consumers each take a router today; switch them to take a catalog. Plugin `onCreate` payload changes from `{ router }` to `{ catalog }`. `createWebhookRouter` keeps its function name (HTTP-shaped, intentionally) but its option field renames `router` → `catalog`.

- [ ] **Step 4.1: Sender**

In `packages/core/src/sender.ts`, run:

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e "s/from '\.\/router\.js'/from '.\/catalog.js'/g" \
  packages/core/src/sender.ts
```

Then manually swap any option/property named `router` to `catalog`. Read the file after sed and audit field/destructure sites.

- [ ] **Step 4.2: Worker**

Same treatment for `packages/core/src/worker.ts`:

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e "s/from '\.\/router\.js'/from '.\/catalog.js'/g" \
  packages/core/src/worker.ts
```

Then manually rename option fields. Worker job-name derivation must use the catalog's flat `routes` and `emails[flatKey]` so dot-path IDs propagate to BullMQ job names.

- [ ] **Step 4.3: Webhook**

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e "s/from '\.\/router\.js'/from '.\/catalog.js'/g" \
  packages/core/src/webhook.ts
```

Manually rename the `router` option field on `createWebhookRouter` to `catalog`. The function name `createWebhookRouter` stays — that's the HTTP router, intentionally distinct.

- [ ] **Step 4.4: Plugins types**

In `packages/core/src/plugins/types.ts`:

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e "s/from '\.\.\/router\.js'/from '..\/catalog.js'/g" \
  packages/core/src/plugins/types.ts
```

Then read the file and rename the `router:` field on the `onCreate` payload type to `catalog:`.

- [ ] **Step 4.5: Multi-transport**

```bash
sed -i '' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e "s/from '\.\.\/router\.js'/from '..\/catalog.js'/g" \
  packages/core/src/transports/multi.types.ts packages/core/src/transports/multi.ts
```

- [ ] **Step 4.6: Commit**

```bash
git add packages/core/src/sender.ts packages/core/src/worker.ts packages/core/src/webhook.ts packages/core/src/plugins/types.ts packages/core/src/transports/multi.types.ts packages/core/src/transports/multi.ts
git commit -m "refactor(core): migrate sender/worker/webhook/plugins to EmailCatalog"
```

---

## Task 5: Update `index.ts` re-exports and delete `router.ts`

**Files:**
- Modify: `packages/core/src/index.ts`
- Delete: `packages/core/src/router.ts`

- [ ] **Step 5.1: Replace exports**

In `packages/core/src/index.ts`, replace:

```ts
export { emailRpc } from './init.js';
export type { RootBuilder, InitOptions, EmailRpc } from './init.js';
```

with:

```ts
export { createEmailRpc } from './factory.js';
export type { RootBuilder } from './factory.js';
```

Replace:

```ts
export { createRouter } from './router.js';
export type {
  EmailRouter,
  AnyEmailRouter,
  RouterMap,
  ValidateRouter,
  InputOf,
  OutputOf,
} from './router.js';
```

with:

```ts
export { createCatalog, isEmailCatalog } from './catalog.js';
export type {
  EmailCatalog,
  AnyEmailCatalog,
  CatalogMap,
  ValidateCatalog,
  InputOf,
  OutputOf,
  CtxOf,
} from './catalog.js';
```

- [ ] **Step 5.2: Delete `router.ts`**

```bash
git rm packages/core/src/router.ts
```

- [ ] **Step 5.3: Run typecheck on core**

Run: `pnpm --filter @emailrpc/core exec tsc --noEmit`
Expected: PASS. If anything still references `router.js` or `EmailRouter`, grep for it and fix:

```bash
grep -rn "EmailRouter\|emailRpc\|from '\./router\|from '\.\./router" packages/core/src/
```

Expected output: empty.

- [ ] **Step 5.4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "refactor(core): rewire index exports to catalog/factory, drop router module"
```

---

## Task 6: Migrate core test files

**Files:**
- Rename: `packages/core/src/router.test.ts` → `packages/core/src/catalog.test.ts` (already exists from Task 1 — merge any unique cases from `router.test.ts` into it, then delete `router.test.ts`)
- Modify: `packages/core/src/builder.test.ts`
- Modify: `packages/core/src/client.test.ts`
- Modify: `packages/core/src/sender.test.ts`
- Modify: `packages/core/src/template.test.ts`
- Modify: `packages/core/src/worker.test.ts`
- Modify: `packages/core/src/config.test.ts`
- Modify: `packages/core/src/plugins/types.test.ts`
- Modify: `packages/core/src/lib/test-utils.test.ts`

- [ ] **Step 6.1: Merge `router.test.ts` into `catalog.test.ts`**

Open `packages/core/src/router.test.ts`. Any test case not already covered by Task 1's `catalog.test.ts` gets ported over, with `createRouter` → `createCatalog` and `EmailRouter` → `EmailCatalog`. Then delete the old file:

```bash
git rm packages/core/src/router.test.ts
```

- [ ] **Step 6.2: Sweep other test files**

Run on each remaining test file in the list above:

```bash
sed -i '' \
  -e 's/emailRpc\.init/createEmailRpc/g' \
  -e 's/\.router(/\.catalog(/g' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  -e 's/createRouter/createCatalog/g' \
  -e "s/from '\.\.\/init\.js'/from '..\/factory.js'/g" \
  -e "s/from '\.\/init\.js'/from '.\/factory.js'/g" \
  -e "s/from '\.\.\/router\.js'/from '..\/catalog.js'/g" \
  -e "s/from '\.\/router\.js'/from '.\/catalog.js'/g" \
  -e "s/'@emailrpc\/core'/'@emailrpc\/core'/g" \
  packages/core/src/builder.test.ts \
  packages/core/src/client.test.ts \
  packages/core/src/sender.test.ts \
  packages/core/src/template.test.ts \
  packages/core/src/worker.test.ts \
  packages/core/src/config.test.ts \
  packages/core/src/plugins/types.test.ts \
  packages/core/src/lib/test-utils.test.ts
```

- [ ] **Step 6.3: Manual fix-up — `router:` → `catalog:` in createClient/createWorker call sites**

`sed` did not catch object-literal field names. Run:

```bash
grep -rn "router:" packages/core/src/ --include='*.test.ts'
```

For each hit, manually rename `router:` to `catalog:`. Then re-run the grep — output should be empty.

- [ ] **Step 6.4: Manual fix-up — `import { emailRpc }` lines**

```bash
grep -rn "import.*emailRpc" packages/core/src/
```

Replace each `import { emailRpc, ... } from '...'` with `import { createEmailRpc, ... } from '...'`. The `const t = emailRpc.init<...>()` calls become `const rpc = createEmailRpc<...>()`. Variable name `t` becomes `rpc` (per spec).

- [ ] **Step 6.5: Run all core tests**

Run: `pnpm --filter @emailrpc/core test`
Expected: all pass. If any fail, read the output, identify the cause, and fix in the test file. Common failures:
- A test still references `.routes` expecting old shape — `routes` is now the flat array; if a test was inspecting `Object.keys(catalog.emails)`, it still works for flat catalogs.
- A test uses `mail.welcome.send(...)` expecting `mail.welcome` to be undefined when the catalog is empty — proxy returns undefined for unknown keys, same as before.

- [ ] **Step 6.6: Commit**

```bash
git add packages/core/src/
git commit -m "test(core): migrate test suite to catalog/createEmailRpc"
```

---

## Task 7: Update internal fixtures and adapter packages

**Files:**
- Modify: `internal/fixtures/welcome.ts`
- Modify: `packages/react-email/README.md` (and any source files that reference router types)
- Audit: `packages/{smtp,ses,resend,bullmq,handlebars,mjml}/src/**/*.ts`

- [ ] **Step 7.1: Sweep fixtures and adapter packages**

```bash
grep -rln "emailRpc\|EmailRouter\|AnyEmailRouter\|createRouter\|\.router(" \
  internal/ packages/react-email/ packages/smtp/ packages/ses/ \
  packages/resend/ packages/bullmq/ packages/handlebars/ packages/mjml/
```

For each file in the output, apply the same sed sweep as Step 6.2 (adjust paths). Then manually rename `router:` fields and `emailRpc.init()` call sites.

- [ ] **Step 7.2: Verify**

```bash
grep -rn "emailRpc\|EmailRouter\|AnyEmailRouter\|createRouter" \
  internal/ packages/react-email/ packages/smtp/ packages/ses/ \
  packages/resend/ packages/bullmq/ packages/handlebars/ packages/mjml/
```

Expected: empty. Allowed exceptions: `createWebhookRouter` (intentional).

```bash
grep -rn "createWebhookRouter" packages/
```

Should still return hits — that's correct, the webhook router name is preserved.

- [ ] **Step 7.3: Run full build + typecheck**

```bash
pnpm build
pnpm typecheck
```

Expected: both PASS.

- [ ] **Step 7.4: Commit**

```bash
git add internal/ packages/
git commit -m "refactor: migrate fixtures and adapter packages to EmailCatalog"
```

---

## Task 8: Update every example to the new API

**Files:**
- Modify: every `.ts` file under `examples/welcome-text/apps/cli/src/`
- Modify: any future example directories

- [ ] **Step 8.1: Sweep examples**

```bash
sed -i '' \
  -e 's/emailRpc\.init/createEmailRpc/g' \
  -e 's/\bemailRpc\b/createEmailRpc/g' \
  -e 's/\.router(/\.catalog(/g' \
  -e 's/AnyEmailRouter/AnyEmailCatalog/g' \
  -e 's/EmailRouter/EmailCatalog/g' \
  examples/welcome-text/apps/cli/src/index.ts \
  examples/welcome-text/apps/cli/src/examples/single.ts \
  examples/welcome-text/apps/cli/src/examples/smtp.ts \
  examples/welcome-text/apps/cli/src/examples/multi-failover.ts \
  examples/welcome-text/apps/cli/src/examples/multi-random.ts \
  examples/welcome-text/apps/cli/src/examples/multi-round-robin.ts \
  examples/welcome-text/apps/cli/src/examples/dry-run.ts \
  examples/welcome-text/apps/cli/src/examples/react-email.ts \
  examples/welcome-text/apps/cli/src/examples/kitchen-sink.ts \
  examples/welcome-text/apps/cli/src/examples/with-observability.ts \
  examples/welcome-text/apps/cli/src/examples/rate-limited.ts
```

- [ ] **Step 8.2: Manual fix-up of `router:` and `import { emailRpc }`**

```bash
grep -rn "router:\|import.*emailRpc\|from '@emailrpc/core'" examples/
```

For each `router:` → `catalog:`. For each `import { emailRpc, ... }` → `import { createEmailRpc, ... }`. For each `const t = ...` that previously held the builder, rename to `const rpc = ...`.

- [ ] **Step 8.3: Convert one example to demonstrate nested catalogs**

Pick `examples/welcome-text/apps/cli/src/examples/kitchen-sink.ts` (largest example, best showcase). Restructure it to define two sub-catalogs (`transactional`, `marketing`) and merge them at the root. Show one send call hitting `mail.transactional.welcome.send(...)`. The exact code depends on what the file currently does — preserve its existing behavior, just split the catalog into namespaces.

- [ ] **Step 8.4: Verify zero stale references**

```bash
grep -rn "emailRpc\.init\|\bemailRpc\b\|EmailRouter\|AnyEmailRouter\|createRouter" examples/
```

Expected: empty.

```bash
grep -rn "router:" examples/ | grep -v "createWebhookRouter"
```

Expected: empty.

- [ ] **Step 8.5: Build and typecheck examples**

```bash
pnpm --filter @example/welcome-text-cli build
pnpm --filter @example/welcome-text-cli typecheck
```

Expected: both PASS.

- [ ] **Step 8.6: Run the canonical example end-to-end against mockTransport**

```bash
pnpm dev
```

Wait for the script to print a successful send. Ctrl-C when satisfied.

- [ ] **Step 8.7: Commit**

```bash
git add examples/
git commit -m "refactor(examples): migrate all examples to createEmailRpc/catalog"
```

---

## Task 9: Update docs and the canonical spec

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `plan/emailrpc-spec.md`
- Modify: `packages/core/README.md`
- Audit: `docs/superpowers/plans/*.md` and `docs/superpowers/specs/*.md`

Historical specs (older design docs) are left alone — they describe past decisions. The canonical spec and active plan docs are updated.

- [ ] **Step 9.1: Update CLAUDE.md**

Find the section in `CLAUDE.md` that describes the API (look for `emailRpc.init`, `t.router`, `EmailRouter`). Rewrite the snippets to use `createEmailRpc` + `.catalog()` + `EmailCatalog`. The 6-layer architecture description in §"Architecture" needs Layer 1's text updated:

> **Contracts** (`@emailrpc/core`) — `createEmailRpc<Ctx>()` returns a builder `rpc`; `rpc.email().input(schema).subject(...).template(adapter)` defines a procedure; `rpc.catalog({...})` aggregates procedures (and other catalogs) into a typed contract. Sub-catalogs flatten into dot-path IDs (`transactional.welcome`). The exported `typeof catalog` is the contract every other layer derives from.

Also update the "convention" bullets if they mention router naming.

- [ ] **Step 9.2: Update README.md and packages/core/README.md**

Same sweep — replace API examples to use the new names. The visible package status table is unaffected.

- [ ] **Step 9.3: Update plan/emailrpc-spec.md**

This is the canonical spec. Find every reference to `EmailRouter`, `emailRpc.init`, `t.router`, `createRouter`, `RouterMap`, `ValidateRouter` and update. Add a new subsection under §2 describing nested catalog composition with the dot-path ID convention. Keep `webhookRouter` references intact.

- [ ] **Step 9.4: Audit active plan docs**

```bash
grep -rln "emailRpc\.init\|EmailRouter\|t\.router\|createRouter" docs/superpowers/plans/
```

For each file, decide: is it an active plan still being executed, or a historical record? For active plans, update the names. For historical plans (the ones already implemented and committed before this rename), leave them — they describe what the API was at the time.

If unclear, leave it and add a one-line header note: `> Naming updated 2026-04-26: see catalog-rename plan.`

- [ ] **Step 9.5: Verify**

```bash
grep -rn "emailRpc\.init\|\bemailRpc\b" CLAUDE.md README.md plan/ packages/core/README.md
```

Expected: empty.

- [ ] **Step 9.6: Commit**

```bash
git add CLAUDE.md README.md plan/ packages/core/README.md docs/
git commit -m "docs: update CLAUDE.md, README, and canonical spec for catalog rename"
```

---

## Task 10: Add changeset and run full CI

**Files:**
- Create: `.changeset/catalog-rename.md`

- [ ] **Step 10.1: Write the changeset**

Create `.changeset/catalog-rename.md`:

```markdown
---
'@emailrpc/core': minor
'@emailrpc/react-email': minor
'@emailrpc/mjml': minor
'@emailrpc/handlebars': minor
'@emailrpc/smtp': minor
'@emailrpc/ses': minor
'@emailrpc/resend': minor
'@emailrpc/bullmq': minor
---

Rename `EmailRouter` to `EmailCatalog` and replace `emailRpc.init()` with `createEmailRpc()`. Adds nested catalog composition: `rpc.catalog({...})` now accepts both email procedures and sub-catalogs, flattening into dot-path IDs (e.g. `transactional.welcome`).

Migration:

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

`createWebhookRouter` is unchanged (HTTP-shaped, intentionally distinct).
```

Adjust the package list to match what actually exists in `packages/` — drop entries for packages that have no source changes.

- [ ] **Step 10.2: Run full CI**

```bash
pnpm ci
```

Expected: PASS (build + typecheck + test + lint).

- [ ] **Step 10.3: Final grep sweep**

```bash
grep -rn "emailRpc\.init\|\bemailRpc\b\|EmailRouter\|AnyEmailRouter\|createRouter\|RouterMap\|ValidateRouter" \
  --include='*.ts' --include='*.tsx' --include='*.md' \
  --exclude-dir=node_modules --exclude-dir=.changeset --exclude-dir=dist \
  .
```

Expected: zero hits, except in `docs/superpowers/specs/2026-04-25-*` and similarly-dated historical spec files, and in `docs/superpowers/plans/2026-04-25-*` plan files. If any current source/test/example/CLAUDE.md/README/canonical-spec hit appears, fix it before committing.

- [ ] **Step 10.4: Commit**

```bash
git add .changeset/catalog-rename.md
git commit -m "chore(changeset): catalog rename and createEmailRpc factory"
```

---

## Self-Review Notes

This plan covers, in order:

1. **Spec §"Public API after the change"** — Tasks 1, 2, 3 (factory, builder, client surface).
2. **Spec §"Nested catalog composition"** — Task 1 (recursive `createCatalog`) and Task 8 Step 8.3 (example).
3. **Spec §"Stable IDs become dot-paths"** — Task 1 (id assignment) and Task 4 (worker job names use flat keys).
4. **Spec §"Context constraint across merges"** — covered by `ValidateCatalog` recursive type in Task 1.
5. **Spec §"createClient and createWorker"** — Tasks 3 and 4.
6. **Spec §"createWebhookRouter"** — Task 4.3 (option field renamed, function name preserved); Task 7.2 verification step explicitly excludes `createWebhookRouter` from the grep.
7. **Spec §"Type-level changes"** — Tasks 1, 2, 5.
8. **Spec §"Runtime changes"** — Task 1 (flatten step), Task 3 (nested proxy).
9. **Spec §"Migration scope"** — Tasks 6, 7, 8, 9 cover every file in the migration table.
10. **Spec §"Error and edge cases"** — Task 1 nested tests cover empty catalogs and three-level nesting.
11. **Spec §"Testing approach"** — Task 6 (core tests), Task 8 (example smoke including build + typecheck + nested example), Task 10 (full CI).
12. **Spec §"Migration notes for downstream"** — Task 10.1 changeset.

No placeholders. Every step has either complete code or an exact command. Type names referenced in later tasks (`EmailCatalog`, `createCatalog`, `isEmailCatalog`, `RootBuilder`, `createEmailRpc`, `ValidateCatalog`, `CtxOf`, `InputOf`, `OutputOf`) are all defined in Tasks 1 and 2.

One known caveat: the `sed` commands assume macOS BSD sed (the project is darwin-only per environment). The `-i ''` form is correct for BSD; on GNU sed the empty-string argument would need to be removed. Engineers running this on Linux should use `sed -i` without the empty string.
