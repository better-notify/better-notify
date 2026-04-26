# multiTransport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `multiTransport` stub at `packages/core/src/transports/multi.ts` with a production-grade composite `Transport` supporting failover and round-robin strategies, optional per-transport retry with backoff, custom `isRetriable` predicate, and structured per-attempt logging.

**Architecture:** `multiTransport(opts)` returns a single `Transport` (`name`, `send`, `verify`, `close`). It owns an in-process round-robin counter, validates options synchronously, iterates inner transports per the configured strategy on each `send()`, and emits orchestration logs through its own bound logger. Wraps every inner call in `handlePromise` so sync throws and rejections are treated identically.

**Tech Stack:** TypeScript, vitest (with fake timers for backoff tests), rolldown. No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-04-26-multi-transport-design.md`

---

## File Structure

**Modify:**
- `packages/core/src/errors.ts` — add `'CONFIG'` to the `ErrorCode` union
- `packages/core/src/transports/multi.types.ts` — replace types: add `MultiTransportStrategy`, drop `weight?`, add `name?`, `maxAttemptsPerTransport?`, `backoff?`, `logger?`
- `packages/core/src/transports/multi.ts` — replace stub with full implementation
- `packages/core/src/transports/multi.test.ts` — replace stub-failing test with full suite
- `packages/core/src/transports/index.ts` — re-export `MultiTransportStrategy`
- `plan/emailrpc-spec.md` — update §7 multi example: drop `weight`, migrate `provider`/`providers` legacy wording to `transport`/`transports`, add `maxAttemptsPerTransport` + `backoff` example

**Add:**
- `.changeset/<random>.md` — `@emailrpc/core` minor bump

No new files. No deletes.

---

### Task 1: Add `'CONFIG'` to `ErrorCode` union

**Files:**
- Modify: `packages/core/src/errors.ts`

- [ ] **Step 1: Edit the union**

In `packages/core/src/errors.ts`, replace the `ErrorCode` union (lines 3–10):

```ts
export type ErrorCode =
  | 'VALIDATION'
  | 'PROVIDER'
  | 'CONFIG'
  | 'TIMEOUT'
  | 'RENDER'
  | 'SUPPRESSED'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';
```

- [ ] **Step 2: Run typecheck to confirm no broken consumers**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: PASS.

- [ ] **Step 3: Run errors test suite**

Run: `pnpm --filter @emailrpc/core exec vitest run src/errors.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/errors.ts
git commit -m "feat(core): add CONFIG error code"
```

---

### Task 2: Update `multi.types.ts`

**Files:**
- Modify: `packages/core/src/transports/multi.types.ts`

- [ ] **Step 1: Replace file contents**

Overwrite `packages/core/src/transports/multi.types.ts`:

```ts
import type { LoggerLike } from '../logger.js';
import type { Transport } from './types.js';

export type MultiTransportStrategy = 'failover' | 'round-robin';

export type MultiTransportEntry = {
  transport: Transport;
};

export type MultiTransportBackoff = {
  initialMs: number;
  factor: number;
  maxMs: number;
};

export type MultiTransportOptions = {
  name?: string;
  strategy: MultiTransportStrategy;
  transports: MultiTransportEntry[];
  maxAttemptsPerTransport?: number;
  backoff?: MultiTransportBackoff;
  isRetriable?: (err: unknown) => boolean;
  logger?: LoggerLike;
};
```

- [ ] **Step 2: Run typecheck — expect failures in `multi.ts`**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: FAIL — current `multi.ts` stub still typechecks (it just imports `MultiTransportOptions`); should still pass since the stub doesn't read fields. Re-run and confirm exit 0.

If typecheck fails, the failures will be in dependent code that referenced `weight`. None expected — note the failure list and report back; otherwise proceed.

- [ ] **Step 3: Re-export `MultiTransportStrategy` from the barrel**

In `packages/core/src/transports/index.ts`, replace the multi line:

```ts
export type { MultiTransportEntry, MultiTransportOptions, MultiTransportBackoff, MultiTransportStrategy } from './multi.types.js';
```

- [ ] **Step 4: Run typecheck again**

Run: `pnpm --filter @emailrpc/core typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transports/multi.types.ts packages/core/src/transports/index.ts
git commit -m "feat(core): expand MultiTransport option types for v0.2"
```

---

### Task 3: Write the full failing test suite

**Files:**
- Modify: `packages/core/src/transports/multi.test.ts`

- [ ] **Step 1: Replace the stub test with the full suite**

Overwrite `packages/core/src/transports/multi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { multiTransport } from './multi.js';
import { EmailRpcError } from '../errors.js';
import { memoryLogger } from '../test.js';
import type { Transport, TransportResult } from './types.js';
import type { RenderedMessage, SendContext } from '../types.js';

const baseMessage: RenderedMessage = {
  to: [{ email: 'rcpt@example.com' }],
  from: { email: 'sender@example.com' },
  subject: 'hi',
  html: '<p>hi</p>',
  text: 'hi',
  headers: {},
  attachments: [],
  inlineAssets: {},
};

const baseCtx: SendContext = {
  route: 'welcome',
  messageId: 'msg-1',
  attempt: 1,
};

type FakeBehavior = 'ok' | Error | ((attempt: number) => 'ok' | Error);

type FakeTransport = Transport & {
  readonly calls: number;
  reset(): void;
};

const fakeTransport = (name: string, queue: FakeBehavior[]): FakeTransport => {
  let calls = 0;
  const result: TransportResult = { accepted: ['rcpt@example.com'], rejected: [], transportMessageId: `${name}-id` };
  return {
    name,
    get calls() {
      return calls;
    },
    reset() {
      calls = 0;
    },
    async send(): Promise<TransportResult> {
      calls += 1;
      const behavior = queue[Math.min(calls - 1, queue.length - 1)] ?? 'ok';
      const decided = typeof behavior === 'function' ? behavior(calls) : behavior;
      if (decided === 'ok') return result;
      throw decided;
    },
  };
};

describe('multiTransport — construction', () => {
  it('throws CONFIG error on empty transports', () => {
    expect(() => multiTransport({ strategy: 'failover', transports: [] })).toThrow(EmailRpcError);
    try {
      multiTransport({ strategy: 'failover', transports: [] });
    } catch (e) {
      expect((e as EmailRpcError).code).toBe('CONFIG');
    }
  });

  it('throws on maxAttemptsPerTransport < 1', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({ strategy: 'failover', transports: [{ transport: t }], maxAttemptsPerTransport: 0 }),
    ).toThrow(/maxAttemptsPerTransport/);
  });

  it('throws on invalid backoff (initialMs <= 0)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 0, factor: 2, maxMs: 1000 },
      }),
    ).toThrow(/backoff/);
  });

  it('throws on invalid backoff (factor < 1)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 10, factor: 0.5, maxMs: 1000 },
      }),
    ).toThrow(/backoff/);
  });

  it('throws on invalid backoff (maxMs < initialMs)', () => {
    const t = fakeTransport('a', ['ok']);
    expect(() =>
      multiTransport({
        strategy: 'failover',
        transports: [{ transport: t }],
        backoff: { initialMs: 100, factor: 2, maxMs: 50 },
      }),
    ).toThrow(/backoff/);
  });

  it('returns a Transport with name "multi" by default', () => {
    const t = fakeTransport('a', ['ok']);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: t }] });
    expect(m.name).toBe('multi');
  });

  it('honors opts.name override', () => {
    const t = fakeTransport('a', ['ok']);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: t }], name: 'composite' });
    expect(m.name).toBe('composite');
  });
});

describe('multiTransport — failover strategy', () => {
  it('returns transport[0] result when it succeeds; never calls transport[1]', async () => {
    const a = fakeTransport('a', ['ok']);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    const res = await m.send(baseMessage, baseCtx);
    expect(res.transportMessageId).toBe('a-id');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(0);
  });

  it('advances on retriable error and returns next transport result', async () => {
    const a = fakeTransport('a', [new Error('boom')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    const res = await m.send(baseMessage, baseCtx);
    expect(res.transportMessageId).toBe('b-id');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('throws lastErr when all transports fail; calls each once', async () => {
    const errA = new Error('a-fail');
    const errB = new Error('b-fail');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', [errB]);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    await expect(m.send(baseMessage, baseCtx)).rejects.toBe(errB);
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('non-retriable on transport[0] still advances to transport[1]', async () => {
    const errA = new Error('fatal');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      isRetriable: () => false,
      logger: log,
    });
    const res = await m.send(baseMessage, baseCtx);
    expect(res.transportMessageId).toBe('b-id');
    const failed = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(failed?.payload.retriable).toBe(false);
  });

  it('maxAttemptsPerTransport: 3 retries the same transport before advancing', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2'), new Error('3')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 3,
    });
    const res = await m.send(baseMessage, baseCtx);
    expect(res.transportMessageId).toBe('b-id');
    expect(a.calls).toBe(3);
    expect(b.calls).toBe(1);
  });
});

describe('multiTransport — round-robin strategy', () => {
  it('counter advances per send() across 4 sends with 2 transports → [2, 2]', async () => {
    const a = fakeTransport('a', ['ok', 'ok', 'ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok', 'ok', 'ok']);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    expect(a.calls).toBe(2);
    expect(b.calls).toBe(2);
  });

  it('round-robin + failover walks forward from rotating start', async () => {
    const a = fakeTransport('a', [new Error('a1'), new Error('a2')]);
    const b = fakeTransport('b', [new Error('b1'), new Error('b2')]);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(a.calls).toBe(2);
    expect(b.calls).toBe(2);
  });

  it('round-robin: when start transport succeeds, others never called', async () => {
    const a = fakeTransport('a', ['ok', 'ok']);
    const b = fakeTransport('b', ['ok', 'ok']);
    const m = multiTransport({
      strategy: 'round-robin',
      transports: [{ transport: a }, { transport: b }],
    });
    await m.send(baseMessage, baseCtx);
    await m.send(baseMessage, baseCtx);
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });
});

describe('multiTransport — backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays follow min(maxMs, initialMs * factor^(attempt-1)) between attempts on the same transport', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2'), new Error('3')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 3,
      backoff: { initialMs: 100, factor: 2, maxMs: 1000 },
    });
    const promise = m.send(baseMessage, baseCtx);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(a.calls).toBe(2);
    await vi.advanceTimersByTimeAsync(200);
    expect(a.calls).toBe(3);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.calls).toBe(1);
    await expect(promise).resolves.toBeDefined();
  });

  it('delay capped at maxMs', async () => {
    const a = fakeTransport('a', [new Error('1'), new Error('2')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 2,
      backoff: { initialMs: 1000, factor: 10, maxMs: 1500 },
    });
    const promise = m.send(baseMessage, baseCtx);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(a.calls).toBe(2);
    await promise;
  });

  it('no backoff config + retries → no setTimeout scheduled', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const a = fakeTransport('a', [new Error('1'), new Error('2')]);
    const b = fakeTransport('b', ['ok']);
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      maxAttemptsPerTransport: 2,
    });
    await m.send(baseMessage, baseCtx);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });
});

describe('multiTransport — isRetriable', () => {
  it('custom predicate marks errors retriable=false but still advances', async () => {
    const errA = new Error('skip');
    const a = fakeTransport('a', [errA]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      isRetriable: (err) => (err as Error).message === 'retry',
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    expect(b.calls).toBe(1);
    const rec = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(rec?.payload.retriable).toBe(false);
  });

  it('default predicate treats every error as retriable', async () => {
    const a = fakeTransport('a', [new Error('boom')]);
    const b = fakeTransport('b', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    const rec = log.records.find(
      (r) => r.message === 'multi attempt failed' && r.payload.transportName === 'a',
    );
    expect(rec?.payload.retriable).toBe(true);
  });
});

describe('multiTransport — verify()', () => {
  it('all inner verify ok → ok=true with per-inner results', async () => {
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: true, details: 'a-ok' }) };
    const b: Transport = { name: 'b', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: true }) };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
    expect(res.details).toEqual({
      results: [
        { name: 'a', ok: true, details: 'a-ok' },
        { name: 'b', ok: true },
      ],
    });
  });

  it('any inner ok → composite ok=true', async () => {
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: false, details: 'down' }) };
    const b: Transport = { name: 'b', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: true }) };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
  });

  it('no inner ok → composite ok=false', async () => {
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: false }) };
    const b: Transport = { name: 'b', send: async () => ({ accepted: [], rejected: [] }), verify: async () => ({ ok: false }) };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    const res = await m.verify!();
    expect(res.ok).toBe(false);
  });

  it('inner without verify → reported as ok: true', async () => {
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }) };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }] });
    const res = await m.verify!();
    expect(res.ok).toBe(true);
    expect(res.details).toEqual({ results: [{ name: 'a', ok: true }] });
  });

  it('inner verify throws → captured as ok: false with details=err; composite does not throw', async () => {
    const err = new Error('verify boom');
    const a: Transport = {
      name: 'a',
      send: async () => ({ accepted: [], rejected: [] }),
      verify: async () => {
        throw err;
      },
    };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }] });
    const res = await m.verify!();
    expect(res.ok).toBe(false);
    expect((res.details as { results: Array<{ details: unknown }> }).results[0].details).toBe(err);
  });
});

describe('multiTransport — close()', () => {
  it('calls every inner close in parallel; composite resolves', async () => {
    const closes: string[] = [];
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }), close: async () => { closes.push('a'); } };
    const b: Transport = { name: 'b', send: async () => ({ accepted: [], rejected: [] }), close: async () => { closes.push('b'); } };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }] });
    await m.close!();
    expect(closes.sort()).toEqual(['a', 'b']);
  });

  it('one inner close throws → logged at error, composite still resolves', async () => {
    const err = new Error('close boom');
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }), close: async () => { throw err; } };
    const b: Transport = { name: 'b', send: async () => ({ accepted: [], rejected: [] }), close: async () => {} };
    const log = memoryLogger();
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }, { transport: b }], logger: log });
    await expect(m.close!()).resolves.toBeUndefined();
    const rec = log.records.find((r) => r.message === 'multi close failed');
    expect(rec?.level).toBe('error');
    expect(rec?.payload.transportName).toBe('a');
    expect(rec?.payload.err).toBe(err);
  });

  it('inner without close → skipped silently', async () => {
    const a: Transport = { name: 'a', send: async () => ({ accepted: [], rejected: [] }) };
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }] });
    await expect(m.close!()).resolves.toBeUndefined();
  });
});

describe('multiTransport — logging', () => {
  it('emits multi attempt ok on success', async () => {
    const a = fakeTransport('a', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }], logger: log });
    await m.send(baseMessage, baseCtx);
    const rec = log.records.find((r) => r.message === 'multi attempt ok');
    expect(rec?.level).toBe('debug');
    expect(rec?.payload).toMatchObject({ transportName: 'a', attempt: 1, strategy: 'failover' });
  });

  it('emits multi exhausted on total failure', async () => {
    const errA = new Error('a-fail');
    const a = fakeTransport('a', [errA]);
    const log = memoryLogger();
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }], logger: log });
    await expect(m.send(baseMessage, baseCtx)).rejects.toBe(errA);
    const rec = log.records.find((r) => r.message === 'multi exhausted');
    expect(rec?.level).toBe('error');
    expect(rec?.payload).toMatchObject({ attempts: 1 });
    expect(rec?.payload.lastErr).toBe(errA);
  });

  it('logger bindings include component=multi-transport and the configured name', async () => {
    const a = fakeTransport('a', ['ok']);
    const log = memoryLogger();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }],
      name: 'composite',
      logger: log,
    });
    await m.send(baseMessage, baseCtx);
    expect(log.records[0]?.bindings).toMatchObject({ component: 'multi-transport', name: 'composite' });
  });

  it('defaults to consoleLogger when opts.logger is unset (warn record reaches console.warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = fakeTransport('a', [new Error('boom')]);
    const m = multiTransport({ strategy: 'failover', transports: [{ transport: a }] });
    await expect(m.send(baseMessage, baseCtx)).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @emailrpc/core exec vitest run src/transports/multi.test.ts`
Expected: FAIL — multiTransport currently throws `EmailRpcNotImplementedError`. Many tests will fail at construction.

- [ ] **Step 3: Commit (red)**

```bash
git add packages/core/src/transports/multi.test.ts
git commit -m "test(core): full multiTransport test suite (red)"
```

---

### Task 4: Implement `multiTransport`

**Files:**
- Modify: `packages/core/src/transports/multi.ts`

- [ ] **Step 1: Replace stub with full implementation**

Overwrite `packages/core/src/transports/multi.ts`:

```ts
import { handlePromise } from '../client.js';
import { EmailRpcError } from '../errors.js';
import { consoleLogger, type LoggerLike } from '../logger.js';
import type { RenderedMessage, SendContext } from '../types.js';
import type { Transport, TransportResult } from './types.js';
import type {
  MultiTransportBackoff,
  MultiTransportEntry,
  MultiTransportOptions,
  MultiTransportStrategy,
} from './multi.types.js';

export type {
  MultiTransportBackoff,
  MultiTransportEntry,
  MultiTransportOptions,
  MultiTransportStrategy,
} from './multi.types.js';

const validateOptions = (opts: MultiTransportOptions): void => {
  if (opts.transports.length === 0) {
    throw new EmailRpcError({
      code: 'CONFIG',
      message: 'multiTransport requires at least one transport',
    });
  }
  const max = opts.maxAttemptsPerTransport ?? 1;
  if (max < 1 || !Number.isInteger(max)) {
    throw new EmailRpcError({
      code: 'CONFIG',
      message: 'maxAttemptsPerTransport must be an integer >= 1',
    });
  }
  if (opts.backoff) {
    const { initialMs, factor, maxMs } = opts.backoff;
    if (initialMs <= 0 || factor < 1 || maxMs < initialMs) {
      throw new EmailRpcError({
        code: 'CONFIG',
        message: 'invalid backoff config',
      });
    }
  }
};

const computeBackoff = (attempt: number, cfg: MultiTransportBackoff): number => {
  const raw = cfg.initialMs * cfg.factor ** (attempt - 1);
  return Math.min(cfg.maxMs, raw);
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const buildOrder = (
  strategy: MultiTransportStrategy,
  n: number,
  startRef: { value: number },
): number[] => {
  if (strategy === 'failover') {
    return Array.from({ length: n }, (_, i) => i);
  }
  const start = startRef.value % n;
  startRef.value = (startRef.value + 1) % n;
  return Array.from({ length: n }, (_, i) => (start + i) % n);
};

const runVerify = async (
  inner: Transport,
): Promise<{ name: string; ok: boolean; details?: unknown }> => {
  if (!inner.verify) return { name: inner.name, ok: true };
  const [res, err] = await handlePromise(inner.verify());
  if (err) return { name: inner.name, ok: false, details: err };
  return res.details === undefined
    ? { name: inner.name, ok: res.ok }
    : { name: inner.name, ok: res.ok, details: res.details };
};

const runClose = async (inner: Transport, log: LoggerLike): Promise<void> => {
  if (!inner.close) return;
  const [, err] = await handlePromise(inner.close());
  if (err) {
    log.error('multi close failed', { err, transportName: inner.name });
  }
};

export const multiTransport = (opts: MultiTransportOptions): Transport => {
  validateOptions(opts);

  const name = opts.name ?? 'multi';
  const strategy = opts.strategy;
  const entries = opts.transports;
  const maxAttempts = opts.maxAttemptsPerTransport ?? 1;
  const isRetriable = opts.isRetriable ?? (() => true);
  const log = (opts.logger ?? consoleLogger()).child({ component: 'multi-transport', name });
  const counter = { value: 0 };

  const send = async (message: RenderedMessage, ctx: SendContext): Promise<TransportResult> => {
    const order = buildOrder(strategy, entries.length, counter);
    let lastErr: unknown;
    let attempts = 0;

    for (const idx of order) {
      const entry: MultiTransportEntry = entries[idx]!;
      const transport = entry.transport;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts += 1;
        const [result, err] = await handlePromise(transport.send(message, ctx));
        if (!err) {
          log.debug('multi attempt ok', { transportName: transport.name, attempt, strategy });
          return result;
        }
        lastErr = err;
        const retriable = isRetriable(err);
        log.warn('multi attempt failed', {
          err,
          transportName: transport.name,
          attempt,
          retriable,
        });
        if (!retriable) break;
        if (attempt < maxAttempts) {
          if (opts.backoff) {
            await sleep(computeBackoff(attempt, opts.backoff));
          }
        }
      }
    }

    log.error('multi exhausted', { attempts, lastErr });
    throw lastErr;
  };

  const verify: Transport['verify'] = async () => {
    const results = await Promise.all(entries.map((e) => runVerify(e.transport)));
    const ok = results.some((r) => r.ok);
    return { ok, details: { results } };
  };

  const close: Transport['close'] = async () => {
    await Promise.all(entries.map((e) => runClose(e.transport, log)));
  };

  return { name, send, verify, close };
};
```

- [ ] **Step 2: Run multi tests to verify they pass**

Run: `pnpm --filter @emailrpc/core exec vitest run src/transports/multi.test.ts`
Expected: PASS, all ~28 tests.

- [ ] **Step 3: Run the full core test suite to confirm no regressions**

Run: `pnpm --filter @emailrpc/core test`
Expected: PASS.

- [ ] **Step 4: Run typecheck and build**

Run: `pnpm --filter @emailrpc/core typecheck && pnpm --filter @emailrpc/core build`
Expected: PASS.

- [ ] **Step 5: Commit (green)**

```bash
git add packages/core/src/transports/multi.ts
git commit -m "feat(core): implement multiTransport with failover and round-robin"
```

---

### Task 5: Update spec doc and add changeset

**Files:**
- Modify: `plan/emailrpc-spec.md`
- Create: `.changeset/<random>.md`

- [ ] **Step 1: Update `plan/emailrpc-spec.md` §7 multi example**

In `plan/emailrpc-spec.md`, locate the `**multi**` block (search for `multi({` around line 716). Replace the whole block (from `**multi** —` heading line through the closing ```` ``` ````) with:

````markdown
**`multiTransport`** — failover or round-robin across transports:

```ts
multiTransport({
  strategy: 'failover', // or 'round-robin'
  transports: [
    { transport: smtpTransport({ /* primary */ }) },
    { transport: smtpTransport({ /* backup */ }) },
  ],
  maxAttemptsPerTransport: 2,
  backoff: { initialMs: 200, factor: 2, maxMs: 2000 },
  isRetriable: (err) =>
    (err as { code?: string }).code === 'ETIMEDOUT' ||
    ((err as { responseCode?: number }).responseCode ?? 0) >= 500,
});
```

Weighted distribution is deferred to v0.3. The `MultiTransportStrategy` union expands without a breaking change.
````

If the surrounding paragraph still says "weighted" as a current strategy, remove that mention.

- [ ] **Step 2: Add a changeset**

Create `.changeset/multi-transport.md`:

```markdown
---
'@emailrpc/core': minor
---

Implement `multiTransport` for production failover and round-robin across multiple transports. Supports per-transport retry with exponential backoff (`maxAttemptsPerTransport`, `backoff`), custom `isRetriable` predicate (defaults to `() => true`), and structured per-attempt logging via `LoggerLike`. `verify()` returns a per-inner report; `close()` swallows individual errors. Adds `'CONFIG'` to the public `ErrorCode` union. Weighted strategy deferred to v0.3.
```

- [ ] **Step 3: Run repo CI**

Run: `pnpm ci`
Expected: PASS across build, typecheck, test, lint.

- [ ] **Step 4: Commit**

```bash
git add plan/emailrpc-spec.md .changeset/multi-transport.md
git commit -m "docs(core): document multiTransport and add changeset"
```

---

## Self-review notes

- Spec coverage: §Public API → Task 2 (types), Task 4 (impl); §Send orchestration → Task 4 (`send`); §Logging → Task 4 (`log.debug/warn/error` lines); §verify() → Task 4 (`runVerify` + `verify` closure); §close() → Task 4 (`runClose` + `close` closure); §File structure → matches; §Testing → Task 3 covers all 28 cases plus extras (caps, default-logger reaches console).
- Construction-time validation uses `EmailRpcError({ code: 'CONFIG' })` per spec, after Task 1 adds `'CONFIG'` to the union.
- `handlePromise` imported from `'../client.js'`. No circular import: `client.ts` imports only from `./transports/types.js`, not from `multi.ts` or the transports barrel.
- All async error handling uses `handlePromise` per project convention. No try/catch added.
- No comments added to source files per project convention. JSDoc on the public `Transport` contract is unchanged.
- Spec test #29 (createClient integration smoke) intentionally omitted from the test file — `client.ts` already has integration tests against `mockTransport`, and the multi-transport unit suite plus `pnpm ci` covers the integration boundary. If desired later, add a single integration test in `client.test.ts`; not on the critical path for this plan.
- One spec assertion clarified during impl-design: `verify()` returns `details: { results }` even when all inner transports lack `verify` (their slot reads `{ name, ok: true }`). Tests cover this.
