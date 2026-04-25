# createClient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `createClient` function — a Proxy-based, fully typed email client that infers route inputs from the router and orchestrates validate → render → send through registered providers.

**Architecture:** `createClient` returns a Proxy keyed by route name. Each route exposes `{ send, render }`. The send pipeline validates input, renders the template, assembles a `RenderedMessage`, selects a provider (by priority or explicit override), and sends. Client-level hooks fire at pipeline boundaries for observability.

**Tech Stack:** TypeScript (strict), Vitest (with typecheck), Zod (tests only), Standard Schema V1

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/core/src/client.ts` | Create | Types (`ProviderEntry`, `ClientHooks`, `CreateClientOptions`, `SendOptions`, `EmailClient`), `handlePromise`, `createClient`, `executeSend`, `executeRender` |
| `packages/core/src/client.test.ts` | Create | Unit + type tests for createClient, send pipeline, render, provider selection, hooks |
| `packages/core/src/test.ts` | Modify | Implement `mockProvider()` — replace stub with working recording provider |
| `packages/core/src/index.ts` | Modify | Re-export `createClient` and client types |
| `packages/core/src/sender.ts` | Modify | Mark `createSender` as deprecated, point to `createClient` |

---

### Task 1: `handlePromise` utility and client types

**Files:**
- Create: `packages/core/src/client.ts`
- Create: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the type assertion tests**

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  ProviderEntry,
  ClientHooks,
  CreateClientOptions,
  SendOptions,
} from './client.js';
import type { Provider } from './provider.js';
import type { AnyEmailRouter } from './router.js';
import type { SendResult } from './types.js';

describe('client types', () => {
  it('SendOptions infers provider names from the providers tuple', () => {
    type Entries = readonly [
      { name: 'ses'; provider: Provider; priority: 1 },
      { name: 'smtp'; provider: Provider; priority: 2 },
    ];
    type Opts = SendOptions<Entries>;
    expectTypeOf<Opts['provider']>().toEqualTypeOf<'ses' | 'smtp' | undefined>();
  });

  it('ProviderEntry has correct shape', () => {
    expectTypeOf<ProviderEntry>().toMatchTypeOf<{
      name: string;
      provider: Provider;
      priority: number;
    }>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: FAIL — cannot find module `./client.js`

- [ ] **Step 3: Write the types and handlePromise in client.ts**

```ts
import type { Provider } from './provider.js';
import type { Address, SendResult } from './types.js';
import type { RenderedOutput } from './template.js';
import type { AnyEmailRouter, InputOf } from './router.js';
import type { EmailRpcError } from './errors.js';

export type ProviderEntry = {
  name: string;
  provider: Provider;
  priority: number;
};

export type ClientHooks = {
  onBeforeSend?: (params: {
    route: string;
    input: unknown;
    messageId: string;
  }) => void | Promise<void>;

  onAfterSend?: (params: {
    route: string;
    result: SendResult;
    durationMs: number;
    messageId: string;
  }) => void | Promise<void>;

  onError?: (params: {
    route: string;
    error: EmailRpcError;
    phase: 'validate' | 'render' | 'send';
    messageId: string;
  }) => void | Promise<void>;
};

export type CreateClientOptions<
  R extends AnyEmailRouter,
  const P extends readonly ProviderEntry[],
> = {
  router: R;
  providers: P;
  defaults?: {
    from?: Address;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
  hooks?: ClientHooks;
};

export type SendOptions<P extends readonly ProviderEntry[]> = {
  provider?: P[number]['name'];
};

export type RenderOptions = {
  format: 'html' | 'text';
};

type RouteMethods<TInput, P extends readonly ProviderEntry[]> = {
  send(input: TInput, opts?: SendOptions<P>): Promise<SendResult>;
  render(input: TInput): Promise<RenderedOutput>;
  render(input: TInput, opts: RenderOptions): Promise<string>;
};

export type EmailClient<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> = {
  [K in keyof R['emails']]: RouteMethods<InputOf<R, K>, P>;
};

export async function handlePromise<T>(
  promise: Promise<T>,
): Promise<[T, null] | [null, Error]> {
  try {
    return [await promise, null];
  } catch (err) {
    return [null, err instanceof Error ? err : new Error(String(err))];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/client.test.ts
git commit -m "feat(core): add client types and handlePromise utility"
```

---

### Task 2: Implement `mockProvider()`

**Files:**
- Modify: `packages/core/src/test.ts`
- Create: `packages/core/src/test.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mockProvider } from './test.js';

describe('mockProvider', () => {
  it('records sent messages', async () => {
    const provider = mockProvider();
    expect(provider.sent).toHaveLength(0);

    const result = await provider.send(
      {
        from: 'hello@example.com',
        to: ['lucas@x.com'],
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'welcome', messageId: 'test-id', attempt: 1 },
    );

    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.rejected).toEqual([]);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
  });

  it('resets recorded messages', async () => {
    const provider = mockProvider();
    await provider.send(
      {
        from: 'a@b.com',
        to: ['c@d.com'],
        subject: 'x',
        html: '',
        text: '',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'test', messageId: 'id', attempt: 1 },
    );
    expect(provider.sent).toHaveLength(1);
    provider.reset();
    expect(provider.sent).toHaveLength(0);
  });

  it('normalizes Address objects to strings', async () => {
    const provider = mockProvider();
    await provider.send(
      {
        from: { name: 'Hello', address: 'hello@example.com' },
        to: [{ name: 'Lucas', address: 'lucas@x.com' }],
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'welcome', messageId: 'test-id', attempt: 1 },
    );
    expect(provider.sent[0]!.to).toEqual(['lucas@x.com']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --reporter verbose src/test.test.ts`
Expected: FAIL — `EmailRpcNotImplementedError: mockProvider() (Layer 2 test utilities)`

- [ ] **Step 3: Implement mockProvider**

Replace the `mockProvider` function and `MockProvider` type in `packages/core/src/test.ts`:

```ts
import type { ProviderResult, Provider } from './provider.js';
import type { RenderedMessage, SendContext, Address } from './types.js';
import type { AnyEmailRouter } from './router.js';
import type { Sender } from './sender.js';
import { EmailRpcNotImplementedError } from './errors.js';

function normalizeAddress(addr: Address): string {
  return typeof addr === 'string' ? addr : addr.address;
}

export type MockProviderRecord = {
  route: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

export type MockProvider = Provider & {
  readonly sent: MockProviderRecord[];
  reset(): void;
};

export function mockProvider(): MockProvider {
  const sent: MockProviderRecord[] = [];

  return {
    name: 'mock',
    async send(message: RenderedMessage, ctx: SendContext): Promise<ProviderResult> {
      const to = message.to.map(normalizeAddress);
      sent.push({
        route: ctx.route,
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return {
        accepted: to,
        rejected: [],
      };
    },
    get sent() {
      return sent;
    },
    reset() {
      sent.length = 0;
    },
  };
}
```

Keep `createTestSender` and `recordHooks` as stubs for now (they depend on createClient which we're building).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --reporter verbose src/test.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/test.ts packages/core/src/test.test.ts
git commit -m "feat(core): implement mockProvider with message recording"
```

---

### Task 3: `executeRender` — validate + render pipeline

**Files:**
- Modify: `packages/core/src/client.ts`
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/client.test.ts`:

```ts
import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { emailRpc } from './index.js';
import { createClient } from './client.js';
import { mockProvider } from './test.js';
import type { RenderedOutput } from './template.js';
import type { TemplateAdapter } from './template.js';
import type {
  ProviderEntry,
  SendOptions,
} from './client.js';
import type { Provider } from './provider.js';

const stubAdapter: TemplateAdapter<{ to: string; name: string }> = {
  render: async (input) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

function createTestRouter() {
  const t = emailRpc.init();
  return t.router({
    welcome: t
      .email('welcome')
      .input(z.object({ to: z.string().email(), name: z.string() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter),
  });
}

describe('client types', () => {
  it('SendOptions infers provider names from the providers tuple', () => {
    type Entries = readonly [
      { name: 'ses'; provider: Provider; priority: 1 },
      { name: 'smtp'; provider: Provider; priority: 2 },
    ];
    type Opts = SendOptions<Entries>;
    expectTypeOf<Opts['provider']>().toEqualTypeOf<'ses' | 'smtp' | undefined>();
  });
});

describe('executeRender', () => {
  it('validates and renders a route', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const output = await mail.welcome.render({ to: 'lucas@x.com', name: 'Lucas' });
    expect(output.html).toBe('<p>Hello Lucas</p>');
    expect(output.text).toBe('Hello Lucas');
  });

  it('returns html string when format is html', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const html = await mail.welcome.render(
      { to: 'lucas@x.com', name: 'Lucas' },
      { format: 'html' },
    );
    expect(html).toBe('<p>Hello Lucas</p>');
  });

  it('returns empty string when format is text and adapter has no text', async () => {
    const noTextAdapter: TemplateAdapter<{ to: string; name: string }> = {
      render: async () => ({ html: '<p>hi</p>' }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email('welcome')
        .input(z.object({ to: z.string().email(), name: z.string() }))
        .subject('Hi')
        .template(noTextAdapter),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const text = await mail.welcome.render(
      { to: 'lucas@x.com', name: 'Lucas' },
      { format: 'text' },
    );
    expect(text).toBe('');
  });

  it('throws EmailRpcValidationError for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.render({ to: 'not-an-email', name: 'Lucas' }),
    ).rejects.toThrow('Validation failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: FAIL — `createClient` is not exported / not a function

- [ ] **Step 3: Implement executeRender and createClient skeleton**

Add to `packages/core/src/client.ts` (after the types):

```ts
import { validate } from './schema.js';
import type { EmailDefinition } from './builder.js';
import type { AnyStandardSchema } from './schema.js';
import type { TemplateAdapter, RenderedOutput } from './template.js';

async function executeRender(
  def: EmailDefinition<unknown, string, AnyStandardSchema, TemplateAdapter<unknown>>,
  rawInput: unknown,
  opts?: RenderOptions,
): Promise<RenderedOutput | string> {
  const input = await validate(def.schema, rawInput, { route: def.id });
  const rendered = await def.template.render(input);

  if (!opts) return rendered;

  if (opts.format === 'html') return rendered.html;
  return rendered.text ?? '';
}

export function createClient<
  R extends AnyEmailRouter,
  const P extends readonly ProviderEntry[],
>(options: CreateClientOptions<R, P>): EmailClient<R, P> {
  const { router, providers } = options;
  const cache = new Map<string, unknown>();

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
  const defaultProvider = sortedProviders[0];
  const providersByName = new Map(providers.map((p) => [p.name, p.provider]));

  return new Proxy({} as EmailClient<R, P>, {
    get(_target, key: string) {
      if (typeof key !== 'string') return undefined;

      const def = (router.emails as Record<string, unknown>)[key] as
        | EmailDefinition<unknown, string, AnyStandardSchema, TemplateAdapter<unknown>>
        | undefined;
      if (!def) return undefined;

      if (cache.has(key)) return cache.get(key);

      const methods = Object.freeze({
        send: async (_input: unknown, _opts?: unknown) => {
          throw new Error('not implemented yet');
        },
        render: (input: unknown, opts?: RenderOptions) => executeRender(def, input, opts),
      });

      cache.set(key, methods);
      return methods;
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/client.test.ts
git commit -m "feat(core): implement executeRender with validation and format options"
```

---

### Task 4: `executeSend` — full send pipeline

**Files:**
- Modify: `packages/core/src/client.ts`
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the test file:

```ts
describe('executeSend', () => {
  it('validates, renders, and sends through the default provider', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
    });

    const result = await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.rejected).toEqual([]);
    expect(result.envelope).toEqual({ from: '', to: ['lucas@x.com'] });
    expect(result.timing.renderMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.sendMs).toBeGreaterThanOrEqual(0);

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Welcome, Lucas!',
      html: '<p>Hello Lucas</p>',
    });
  });

  it('uses defaults.from when contract has no from', async () => {
    const router = createTestRouter();
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'default@example.com' },
    });

    const result = await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(result.envelope.from).toBe('default@example.com');
  });

  it('uses adapter subject over definition subject when adapter returns one', async () => {
    const adapterWithSubject: TemplateAdapter<{ to: string; name: string }> = {
      render: async () => ({
        html: '<p>hi</p>',
        subject: 'From Adapter',
      }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email('welcome')
        .input(z.object({ to: z.string().email(), name: z.string() }))
        .subject('From Definition')
        .template(adapterWithSubject),
    });
    const provider = mockProvider();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(provider.sent[0]!.subject).toBe('From Adapter');
  });

  it('throws validation error for invalid input', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'bad', name: 'Lucas' }),
    ).rejects.toThrow('Validation failed');
  });

  it('throws when no from address is available', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    await expect(
      mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' }),
    ).rejects.toThrow('from');
  });
});
```

Note: The "throws when no from address is available" test expects the error when neither contract nor defaults have `from`. The "validates, renders, and sends" test will also fail initially because `send` throws "not implemented yet" — but once we implement it, the test for missing `from` checks the guard. Actually, the welcome contract has no `.from()` set and no defaults, so the first test should use `defaults: { from: ... }` or this test needs adjustment. Let me revise:

The first test ("validates, renders, and sends") should include `defaults: { from: 'hello@example.com' }` so it passes. The "throws when no from" test has neither.

Updated first test assertion for envelope:
```ts
expect(result.envelope).toEqual({ from: 'hello@example.com', to: ['lucas@x.com'] });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: FAIL — send throws "not implemented yet"

- [ ] **Step 3: Implement executeSend**

Replace the `send` stub in `createClient` and add the `executeSend` function in `packages/core/src/client.ts`:

```ts
import { EmailRpcError } from './errors.js';
import type { RenderedMessage, SendContext } from './types.js';
import type { SubjectResolver } from './builder.js';

function normalizeAddress(addr: Address): string {
  return typeof addr === 'string' ? addr : addr.address;
}

function resolveSubject<T>(
  resolver: SubjectResolver<T>,
  input: T,
  adapterSubject: string | undefined,
): string {
  if (adapterSubject) return adapterSubject;
  if (typeof resolver === 'function') return resolver({ input });
  return resolver;
}

type SendPipelineContext = {
  providersByName: Map<string, Provider>;
  defaultProvider: ProviderEntry | undefined;
  defaults?: CreateClientOptions<AnyEmailRouter, readonly ProviderEntry[]>['defaults'];
  hooks?: ClientHooks;
  route: string;
};

async function fireHookSafe(fn: (() => void | Promise<void>) | undefined): Promise<void> {
  if (!fn) return;
  const [, err] = await handlePromise(Promise.resolve(fn()));
  if (err) console.error('[emailrpc] hook error:', err);
}

async function executeSend(
  def: EmailDefinition<unknown, string, AnyStandardSchema, TemplateAdapter<unknown>>,
  rawInput: unknown,
  opts: { provider?: string } | undefined,
  ctx: SendPipelineContext,
): Promise<SendResult> {
  const messageId = crypto.randomUUID();

  const [input, validateErr] = await handlePromise(
    validate(def.schema, rawInput, { route: ctx.route }),
  );
  if (validateErr) {
    await fireHookSafe(
      ctx.hooks?.onError
        ? () => ctx.hooks!.onError!({ route: ctx.route, error: validateErr as EmailRpcError, phase: 'validate', messageId })
        : undefined,
    );
    throw validateErr;
  }

  await fireHookSafe(
    ctx.hooks?.onBeforeSend
      ? () => ctx.hooks!.onBeforeSend!({ route: ctx.route, input, messageId })
      : undefined,
  );

  const renderStart = performance.now();
  const [rendered, renderErr] = await handlePromise(def.template.render(input));
  const renderMs = performance.now() - renderStart;

  if (renderErr) {
    const wrapped = new EmailRpcError({
      message: `Render failed for route "${ctx.route}": ${renderErr.message}`,
      code: 'RENDER',
      route: ctx.route,
      messageId,
      cause: renderErr,
    });
    await fireHookSafe(
      ctx.hooks?.onError
        ? () => ctx.hooks!.onError!({ route: ctx.route, error: wrapped, phase: 'render', messageId })
        : undefined,
    );
    throw wrapped;
  }

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

  const toRaw = (input as Record<string, unknown>).to;
  if (!toRaw) {
    throw new EmailRpcError({
      message: `Route "${ctx.route}" input is missing a "to" field.`,
      code: 'VALIDATION',
      route: ctx.route,
      messageId,
    });
  }
  const toAddresses: Address[] = Array.isArray(toRaw) ? toRaw : [toRaw as Address];

  const message: RenderedMessage = {
    from: fromAddr,
    to: toAddresses,
    subject,
    html: rendered.html,
    text: rendered.text ?? '',
    headers: { ...ctx.defaults?.headers },
    attachments: [],
    inlineAssets: {},
  };

  if (def.replyTo ?? ctx.defaults?.replyTo) {
    message.replyTo = def.replyTo ?? ctx.defaults?.replyTo;
  }

  if (def.tags) {
    for (const [k, v] of Object.entries(def.tags)) {
      message.headers[`X-EmailRpc-Tag-${k}`] = String(v);
    }
  }

  let provider: Provider;
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
    provider = found;
  } else if (ctx.defaultProvider) {
    provider = ctx.defaultProvider.provider;
  } else {
    throw new EmailRpcError({
      message: 'No providers registered.',
      code: 'PROVIDER',
      route: ctx.route,
      messageId,
    });
  }

  const sendContext: SendContext = { route: ctx.route, messageId, attempt: 1 };
  const sendStart = performance.now();
  const [providerResult, sendErr] = await handlePromise(provider.send(message, sendContext));
  const sendMs = performance.now() - sendStart;

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
    await fireHookSafe(
      ctx.hooks?.onError
        ? () => ctx.hooks!.onError!({ route: ctx.route, error: wrapped, phase: 'send', messageId })
        : undefined,
    );
    throw wrapped;
  }

  const result: SendResult = {
    messageId,
    providerMessageId: providerResult.providerMessageId,
    accepted: providerResult.accepted,
    rejected: providerResult.rejected,
    envelope: {
      from: normalizeAddress(fromAddr),
      to: toAddresses.map(normalizeAddress),
    },
    timing: { renderMs, sendMs },
  };

  await fireHookSafe(
    ctx.hooks?.onAfterSend
      ? () => ctx.hooks!.onAfterSend!({
          route: ctx.route,
          result,
          durationMs: renderMs + sendMs,
          messageId,
        })
      : undefined,
  );

  return result;
}
```

Then update the Proxy `send` method in `createClient`:

```ts
const methods = Object.freeze({
  send: (input: unknown, sendOpts?: { provider?: string }) =>
    executeSend(def, input, sendOpts, {
      providersByName,
      defaultProvider,
      defaults: options.defaults,
      hooks: options.hooks,
      route: key,
    }),
  render: (input: unknown, renderOpts?: RenderOptions) =>
    executeRender(def, input, renderOpts),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/client.test.ts
git commit -m "feat(core): implement executeSend pipeline with provider selection"
```

---

### Task 5: Provider selection and override

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('provider selection', () => {
  it('uses the lowest-priority provider by default', async () => {
    const router = createTestRouter();
    const primary = mockProvider();
    const secondary = mockProvider();
    const mail = createClient({
      router,
      providers: [
        { name: 'secondary', provider: secondary, priority: 2 },
        { name: 'primary', provider: primary, priority: 1 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(primary.sent).toHaveLength(1);
    expect(secondary.sent).toHaveLength(0);
  });

  it('overrides to a named provider', async () => {
    const router = createTestRouter();
    const primary = mockProvider();
    const secondary = mockProvider();
    const mail = createClient({
      router,
      providers: [
        { name: 'primary', provider: primary, priority: 1 },
        { name: 'secondary', provider: secondary, priority: 2 },
      ],
      defaults: { from: 'a@b.com' },
    });

    await mail.welcome.send(
      { to: 'lucas@x.com', name: 'Lucas' },
      { provider: 'secondary' },
    );
    expect(primary.sent).toHaveLength(0);
    expect(secondary.sent).toHaveLength(1);
  });

  it('throws for unknown provider name', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
    });

    await expect(
      mail.welcome.send(
        { to: 'lucas@x.com', name: 'Lucas' },
        { provider: 'nonexistent' as any },
      ),
    ).rejects.toThrow('not registered');
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or fails)**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`

These tests should already pass if Task 4's `executeSend` was implemented correctly. If they fail, fix the provider selection logic.

Expected: PASS (provider selection is already in executeSend)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/client.test.ts
git commit -m "test(core): add provider selection and override tests"
```

---

### Task 6: Client-level hooks

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('client hooks', () => {
  it('fires onBeforeSend and onAfterSend', async () => {
    const router = createTestRouter();
    const calls: string[] = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onBeforeSend: ({ route, messageId }) => {
          calls.push(`before:${route}:${messageId}`);
        },
        onAfterSend: ({ route, durationMs }) => {
          calls.push(`after:${route}`);
          expect(durationMs).toBeGreaterThanOrEqual(0);
        },
      },
    });

    await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^before:welcome:/);
    expect(calls[1]).toBe('after:welcome');
  });

  it('fires onError on validation failure', async () => {
    const router = createTestRouter();
    const errors: Array<{ phase: string; route: string }> = [];
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onError: ({ route, phase }) => {
          errors.push({ route, phase });
        },
      },
    });

    await expect(
      mail.welcome.send({ to: 'bad', name: 'Lucas' }),
    ).rejects.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ route: 'welcome', phase: 'validate' });
  });

  it('hook errors do not affect the send result', async () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      hooks: {
        onAfterSend: () => {
          throw new Error('hook boom');
        },
      },
    });

    const result = await mail.welcome.send({ to: 'lucas@x.com', name: 'Lucas' });
    expect(result.accepted).toEqual(['lucas@x.com']);
  });
});
```

- [ ] **Step 2: Run test to verify**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`

These should pass since hooks are already wired in `executeSend` from Task 4. If any fail, fix the hook wiring.

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/client.test.ts
git commit -m "test(core): add client hooks tests"
```

---

### Task 7: Type inference tests

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the type tests**

```ts
describe('type inference', () => {
  it('client routes have correct input types', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [
        { name: 'ses', provider: mockProvider(), priority: 1 },
        { name: 'smtp', provider: mockProvider(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send).parameter(0).toMatchTypeOf<{
      to: string;
      name: string;
    }>();

    expectTypeOf(mail.welcome.render).parameter(0).toMatchTypeOf<{
      to: string;
      name: string;
    }>();
  });

  it('send options autocomplete provider names', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [
        { name: 'ses', provider: mockProvider(), priority: 1 },
        { name: 'smtp', provider: mockProvider(), priority: 2 },
      ] as const,
    });

    expectTypeOf(mail.welcome.send).parameter(1).toMatchTypeOf<
      { provider?: 'ses' | 'smtp' } | undefined
    >();
  });

  it('nonexistent routes are undefined', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    expectTypeOf((mail as any).nonexistent).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test with typecheck**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS (vitest typecheck is enabled in vitest.config.ts)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/client.test.ts
git commit -m "test(core): add type inference tests for createClient"
```

---

### Task 8: Proxy caching and edge cases

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the tests**

```ts
describe('proxy behavior', () => {
  it('caches route methods — same object on repeated access', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    const a = mail.welcome;
    const b = mail.welcome;
    expect(a).toBe(b);
  });

  it('returns undefined for routes not in the router', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    expect((mail as any).nonexistent).toBeUndefined();
  });

  it('route methods are frozen', () => {
    const router = createTestRouter();
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
    });

    expect(Object.isFrozen(mail.welcome)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/client.test.ts
git commit -m "test(core): add proxy caching and edge case tests"
```

---

### Task 9: Re-exports, sender deprecation, and package.json

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/sender.ts`

- [ ] **Step 1: Update index.ts to re-export createClient**

Add to `packages/core/src/index.ts`:

```ts
export { createClient, handlePromise } from './client.js';
export type {
  ProviderEntry,
  ClientHooks,
  CreateClientOptions,
  SendOptions,
  RenderOptions,
  EmailClient,
} from './client.js';
```

- [ ] **Step 2: Update sender.ts to mark createSender as deprecated**

In `packages/core/src/sender.ts`, update the `createSender` function to point to `createClient`:

```ts
/** @deprecated Use `createClient` from `@emailrpc/core` instead. */
export function createSender<R extends AnyEmailRouter, Ctx = {}>(
  _opts: CreateSenderOptions<R, Ctx>,
): Sender<R> {
  throw new EmailRpcNotImplementedError(
    'createSender is deprecated. Use createClient from @emailrpc/core instead.',
  );
}
```

- [ ] **Step 3: Run full test suite**

Run: `cd packages/core && pnpm test -- --reporter verbose`
Expected: All tests PASS

- [ ] **Step 4: Run typecheck**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/sender.ts
git commit -m "feat(core): re-export createClient, deprecate createSender"
```

---

### Task 10: Integration test — full end-to-end flow

**Files:**
- Modify: `packages/core/src/client.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
describe('integration: full end-to-end', () => {
  it('builds a router, creates a client, sends and renders', async () => {
    const t = emailRpc.init();

    const adapter: TemplateAdapter<{ to: string; name: string; verifyUrl: string }> = {
      render: async (input) => ({
        html: `<h1>Welcome ${input.name}</h1><a href="${input.verifyUrl}">Verify</a>`,
        text: `Welcome ${input.name}! Verify: ${input.verifyUrl}`,
      }),
    };

    const router = t.router({
      welcome: t
        .email('welcome')
        .input(
          z.object({
            to: z.string().email(),
            name: z.string(),
            verifyUrl: z.string().url(),
          }),
        )
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .from('hello@example.com')
        .template(adapter),
    });

    const provider = mockProvider();
    const hookCalls: string[] = [];

    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider, priority: 1 }],
      hooks: {
        onBeforeSend: () => { hookCalls.push('before'); },
        onAfterSend: () => { hookCalls.push('after'); },
      },
    });

    const result = await mail.welcome.send({
      to: 'lucas@x.com',
      name: 'Lucas',
      verifyUrl: 'https://example.com/verify/abc',
    });

    expect(result.messageId).toBeDefined();
    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.envelope).toEqual({
      from: 'hello@example.com',
      to: ['lucas@x.com'],
    });

    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Welcome, Lucas!',
      html: '<h1>Welcome Lucas</h1><a href="https://example.com/verify/abc">Verify</a>',
    });

    expect(hookCalls).toEqual(['before', 'after']);

    const output = await mail.welcome.render({
      to: 'lucas@x.com',
      name: 'Lucas',
      verifyUrl: 'https://example.com/verify/abc',
    });
    expect(output.html).toContain('Welcome Lucas');
    expect(output.text).toContain('Verify');
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd packages/core && pnpm test -- --reporter verbose src/client.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full test suite across the monorepo**

Run: `pnpm -r test`
Expected: All packages PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/client.test.ts
git commit -m "test(core): add end-to-end integration test for createClient"
```
