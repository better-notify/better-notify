import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createJobProcessor,
  createQueueWorker,
  createQueueRouter,
  createQueueProducer,
  createQueueConsumer,
  createMockQueue,
  type QueueConsumer,
  type PulledJob,
} from './worker.js';
import type { AnyChannel, AnyCatalog, ChannelDefinition } from '../index.js';
import type { Transport } from '../transport.js';
import type { JobResult } from './types.js';
import { NotifyRpcError, NotifyRpcProviderError } from '../errors.js';

type TArgs = { to: string; input: { name: string } };

const testChannel = (): AnyChannel =>
  ({
    name: 'test',
    createBuilder: () => ({}),
    finalize: (s: unknown) => s as ChannelDefinition<TArgs, any>,
    validateArgs: (a: unknown) => {
      const x = a as Record<string, unknown>;
      if (!x.to || typeof x.to !== 'string') throw new Error('to required');
      return x as TArgs;
    },
    render: async (def: any, args: TArgs) => ({
      body: def.runtime.template(args.input),
      to: args.to,
    }),
    _transport: undefined as never,
  }) as unknown as AnyChannel;

const buildCatalog = (): AnyCatalog => {
  const def: ChannelDefinition<TArgs, any> = {
    id: 'welcome',
    channel: 'test',
    schema: z.object({ name: z.string() }),
    middleware: [],
    runtime: { template: (i: { name: string }) => `Hi ${i.name}` },
    _args: undefined as never,
    _rendered: undefined as never,
  };
  return {
    _brand: 'Catalog',
    _ctx: undefined as never,
    _channels: undefined as never,
    definitions: { welcome: def },
    nested: { welcome: def as any },
    routes: ['welcome'],
  };
};

const okTransport = (): Transport => ({
  name: 'ok',
  send: async () => ({ ok: true, data: { id: 'sent-1' } }),
});

describe('createJobProcessor', () => {
  const channels = { test: testChannel() };

  it('returns { status: "sent" } on success', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
    });
    const r = await p.process({
      id: '1',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r).toEqual({ status: 'sent', messageId: expect.any(String) });
  });

  it('DLQs unknown_route when route missing', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
    });
    const r = await p.process({ id: '2', route: 'nope', args: {}, attempt: 0, enqueuedAt: 't' });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('unknown_route');
  });

  it('DLQs schema_mismatch on bad input', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
    });
    const r = await p.process({
      id: '3',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 42 } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('schema_mismatch');
  });

  it('retries on a retriable provider error', async () => {
    const transport: Transport = {
      name: 'flaky',
      send: async () => ({
        ok: false,
        error: new NotifyRpcProviderError({ message: 'down', provider: 'flaky', retriable: true }),
      }),
    };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: transport },
    });
    const r = await p.process({
      id: '4',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('retry');
  });

  it('DLQs send_failed on a non-retriable provider error', async () => {
    const transport: Transport = {
      name: 'bad',
      send: async () => ({
        ok: false,
        error: new NotifyRpcProviderError({
          message: 'bad addr',
          provider: 'bad',
          retriable: false,
        }),
      }),
    };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: transport },
    });
    const r = await p.process({
      id: '5',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('send_failed');
  });

  it('rebuilds ctx via the context factory and DLQs send_failed if it throws a plain Error', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      context: () => {
        throw new Error('ctx boom');
      },
    });
    const r = await p.process({
      id: '6',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('send_failed');
  });

  it('DLQs send_failed if context factory throws a NotifyRpcError', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      context: () => {
        throw new NotifyRpcError({ message: 'ctx rpc', code: 'CONFIG', route: 'welcome' });
      },
    });
    const r = await p.process({
      id: '7',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('send_failed');
  });

  it('wraps a plain Error thrown by pipeline (hook path) into send_failed dlq', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      hooks: {
        onBeforeSend: () => {
          throw new Error('plain hook boom');
        },
      },
    });
    const r = await p.process({
      id: '8',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('send_failed');
  });

  it('DLQs unknown_route via classify when no channel registered (CONFIG code from pipeline)', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      transportsByChannel: { test: okTransport() },
    });
    const r = await p.process({
      id: '9',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('unknown_route');
  });

  it('uses provided logger and channels default to empty when omitted', async () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
    });
    const r = await p.process({
      id: '10',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('sent');
  });

  it('plugin middleware runs when passed to createJobProcessor', async () => {
    const middlewareFired: string[] = [];
    const plugin = {
      name: 'test-plugin',
      middleware: [
        async ({ next }: { next: () => Promise<unknown> }) => {
          middlewareFired.push('mw');
          return next();
        },
      ],
    };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      plugins: [plugin],
    });
    const r = await p.process({
      id: '11',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('sent');
    expect(middlewareFired).toEqual(['mw']);
  });

  it('plugin middleware that throws causes send_failed dlq', async () => {
    const plugin = {
      name: 'throw-plugin',
      middleware: [
        async () => {
          throw new Error('plugin mw boom');
        },
      ],
    };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      plugins: [plugin],
    });
    const r = await p.process({
      id: '12',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('dlq');
    if (r.status === 'dlq') expect(r.reason).toBe('send_failed');
  });

  it('plugin hooks.onAfterSend fires on successful queued send via createJobProcessor', async () => {
    const hookFired: string[] = [];
    const plugin = {
      name: 'hook-plugin',
      hooks: {
        onAfterSend: () => {
          hookFired.push('after');
        },
      },
    };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      plugins: [plugin],
    });
    const r = await p.process({
      id: '13',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('sent');
    expect(hookFired).toEqual(['after']);
  });

  it('plugin without middleware or hooks does not crash', async () => {
    const plugin = { name: 'bare-plugin' };
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      plugins: [plugin],
    });
    const r = await p.process({
      id: '14',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(r.status).toBe('sent');
  });
});

describe('createQueueWorker pull-loop', () => {
  const channels = { test: testChannel() };

  it('processes pulled jobs, acks sent, dead-letters dlq, emits events', async () => {
    const job = (id: string, route: string, input: unknown): PulledJob => ({
      envelope: { id, route, args: { to: 'a@b.c', input }, attempt: 0, enqueuedAt: 't' },
      raw: id,
    });
    const acked: string[] = [];
    const dead: PulledJob[] = [];
    let drained = false;
    const consumer: QueueConsumer = {
      pull: async () => {
        if (drained) return [];
        drained = true;
        return [job('ok', 'welcome', { name: 'Ada' }), job('bad', 'welcome', { name: 99 })];
      },
      ack: async (j) => {
        acked.push(j.envelope.id);
      },
      retry: async () => {},
      deadLetter: async (j) => {
        dead.push(j);
      },
    };
    const completed: JobResult[] = [];
    const failed: JobResult[] = [];
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
      concurrency: 2,
      idleDelayMs: 1,
    });
    worker.on('completed', (r) => completed.push(r));
    worker.on('failed', (r) => failed.push(r));
    const startP = worker.start();
    await new Promise((r) => setTimeout(r, 25));
    await worker.close();
    await startP;
    expect(acked).toContain('ok');
    expect(dead.map((d) => d.envelope.id)).toContain('bad');
    expect(completed.some((c) => c.status === 'sent')).toBe(true);
    expect(failed.some((f) => f.status === 'dlq')).toBe(true);
  });

  it('calls consumer.retry when a job result is retry', async () => {
    const { NotifyRpcProviderError } = await import('../errors.js');
    const retried: PulledJob[] = [];
    let drained = false;
    const consumer: QueueConsumer = {
      pull: async () => {
        if (drained) return [];
        drained = true;
        return [
          {
            envelope: {
              id: 'r1',
              route: 'welcome',
              args: { to: 'a@b.c', input: { name: 'Ada' } },
              attempt: 0,
              enqueuedAt: 't',
            },
            raw: 'r1',
          },
        ];
      },
      ack: async () => {},
      retry: async (j) => {
        retried.push(j);
      },
      deadLetter: async () => {},
    };
    const flaky: Transport = {
      name: 'flaky',
      send: async () => ({
        ok: false,
        error: new NotifyRpcProviderError({ message: 'down', provider: 'flaky', retriable: true }),
      }),
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: flaky },
      consumer,
      idleDelayMs: 1,
    });
    const p = worker.start();
    await new Promise((r) => setTimeout(r, 20));
    await worker.close();
    await p;
    expect(retried.map((j) => j.envelope.id)).toContain('r1');
  });

  it('start() is idempotent and close() before start() is safe', async () => {
    let pullCalls = 0;
    const consumer: QueueConsumer = {
      pull: async () => {
        pullCalls++;
        return [];
      },
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
      idleDelayMs: 1,
    });
    await worker.close();
    const p1 = worker.start();
    await new Promise((r) => setTimeout(r, 10));
    const p2 = worker.start();
    await worker.close();
    await Promise.all([p1, p2]);
    expect(pullCalls).toBeGreaterThan(0);
  });

  it('continues when consumer.pull rejects', async () => {
    let calls = 0;
    const consumer: QueueConsumer = {
      pull: async () => {
        calls++;
        if (calls === 1) throw new Error('pull boom');
        return [];
      },
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
      idleDelayMs: 1,
    });
    const p = worker.start();
    await new Promise((r) => setTimeout(r, 15));
    await worker.close();
    await p;
    expect(calls).toBeGreaterThan(1);
  });

  it('skips idle delay when running is false after pull error (pull-error if(running) false branch)', async () => {
    let rejectPull!: (e: Error) => void;
    let pullCalls = 0;
    const consumer: QueueConsumer = {
      pull: () => {
        pullCalls++;
        return new Promise<PulledJob[]>((_resolve, reject) => {
          rejectPull = reject;
        });
      },
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
      idleDelayMs: 50000,
    });
    const startP = worker.start();
    await Promise.resolve();
    const closeP = worker.close();
    rejectPull(new Error('pull rejected after close'));
    await closeP;
    await startP;
    expect(pullCalls).toBeGreaterThan(0);
  });

  it('skips idle delay when running is false after empty pull (empty-jobs if(running) false branch)', async () => {
    let resolvePull!: (v: PulledJob[]) => void;
    let first = true;
    let pullCalls = 0;
    const consumer: QueueConsumer = {
      pull: () =>
        new Promise<PulledJob[]>((resolve) => {
          pullCalls++;
          if (first) {
            first = false;
            resolvePull = resolve;
          } else {
            resolve([]);
          }
        }),
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
      idleDelayMs: 50000,
    });
    const startP = worker.start();
    await Promise.resolve();
    const closeP = worker.close();
    resolvePull([]);
    await closeP;
    await startP;
    expect(pullCalls).toBeGreaterThan(0);
  });

  it('uses default idleDelayMs when option is omitted', async () => {
    let calls = 0;
    const consumer: QueueConsumer = {
      pull: async () => {
        calls++;
        return [];
      },
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: okTransport() },
      consumer,
    });
    const p = worker.start();
    await new Promise((r) => setTimeout(r, 10));
    await worker.close();
    await p;
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('dead-letters with retries_exhausted when attempt + 1 >= maxAttempts', async () => {
    const { NotifyRpcProviderError } = await import('../errors.js');
    const q = createMockQueue();
    await q.producer.enqueue({
      id: 'exhausted',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 1,
      enqueuedAt: new Date().toISOString(),
    });

    const flaky: Transport = {
      name: 'flaky',
      send: async () => ({
        ok: false,
        error: new NotifyRpcProviderError({ message: 'down', provider: 'flaky', retriable: true }),
      }),
    };

    const retried: string[] = [];
    const deadLettered: Array<{ id: string; reason: string }> = [];
    const consumerWithTracking: QueueConsumer = {
      pull: async (limit) => q.consumer.pull(limit, new AbortController().signal),
      ack: async () => {},
      retry: async (job) => {
        retried.push(job.envelope.id);
        return q.consumer.retry(job, {
          name: 'E',
          code: 'PROVIDER',
          message: 'x',
          retriable: true,
        });
      },
      deadLetter: async (job, result) => {
        if (result.status === 'dlq')
          deadLettered.push({ id: job.envelope.id, reason: result.reason });
        return q.consumer.deadLetter(job, result);
      },
    };

    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: flaky },
      consumer: consumerWithTracking,
      idleDelayMs: 1,
      maxAttempts: 2,
    });
    const p = worker.start();
    await new Promise((r) => setTimeout(r, 30));
    await worker.close();
    await p;

    expect(retried).not.toContain('exhausted');
    expect(deadLettered.some((d) => d.id === 'exhausted' && d.reason === 'retries_exhausted')).toBe(
      true,
    );
  });

  it('retries when attempt + 1 < maxAttempts (cap not reached)', async () => {
    const { NotifyRpcProviderError } = await import('../errors.js');
    const retried: string[] = [];
    let drained = false;
    const consumer: QueueConsumer = {
      pull: async () => {
        if (drained) return [];
        drained = true;
        return [
          {
            envelope: {
              id: 'retry-ok',
              route: 'welcome',
              args: { to: 'a@b.c', input: { name: 'Ada' } },
              attempt: 0,
              enqueuedAt: 't',
            },
            raw: 'retry-ok',
          },
        ];
      },
      ack: async () => {},
      retry: async (job) => {
        retried.push(job.envelope.id);
      },
      deadLetter: async () => {},
    };
    const flaky: Transport = {
      name: 'flaky',
      send: async () => ({
        ok: false,
        error: new NotifyRpcProviderError({ message: 'down', provider: 'flaky', retriable: true }),
      }),
    };
    const worker = createQueueWorker({
      catalog: buildCatalog(),
      channels,
      transportsByChannel: { test: flaky },
      consumer,
      idleDelayMs: 1,
      maxAttempts: 3,
    });
    const p = worker.start();
    await new Promise((r) => setTimeout(r, 20));
    await worker.close();
    await p;
    expect(retried).toContain('retry-ok');
  });
});

describe('createQueueRouter', () => {
  it('routes a known key and returns undefined for unknown', () => {
    const p = createJobProcessor({
      catalog: buildCatalog(),
      channels: { test: testChannel() },
      transportsByChannel: { test: okTransport() },
    });
    const router = createQueueRouter({ 'tx-emails': p });
    expect(router.route('tx-emails')).toBe(p);
    expect(router.route('nope')).toBeUndefined();
  });
});

describe('queue end-to-end', () => {
  it('enqueue via client, drain via worker, transport receives the send', async () => {
    const { createClient } = await import('../client.js');
    const catalog = buildCatalog();
    const q = createMockQueue();
    const sentRoutes: string[] = [];
    const trackingTransport: Transport = {
      name: 't',
      send: async (rendered, ctx) => {
        sentRoutes.push(ctx.route);
        return okTransport().send(rendered, ctx);
      },
    };

    const mail = createClient({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: trackingTransport },
      queue: q.producer,
    }) as unknown as { welcome: { queue: (a: unknown) => Promise<{ id: string }> } };

    await mail.welcome.queue({ to: 'a@b.c', input: { name: 'Ada' } });

    await q.producer.enqueue({
      id: 'bad-input',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 77 } },
      attempt: 0,
      enqueuedAt: new Date().toISOString(),
    });

    const worker = createQueueWorker({
      catalog,
      channels: { test: testChannel() },
      transportsByChannel: { test: trackingTransport },
      consumer: q.consumer,
      concurrency: 5,
      idleDelayMs: 1,
    });
    const startP = worker.start();
    await new Promise((r) => setTimeout(r, 40));
    await worker.close();
    await startP;

    expect(sentRoutes).toContain('welcome');
    expect(q.dlq).toHaveLength(1);
    expect(q.dlq[0]?.result.status).toBe('dlq');
    if (q.dlq[0]?.result.status === 'dlq') expect(q.dlq[0].result.reason).toBe('schema_mismatch');
  });
});

describe('createMockQueue', () => {
  it('enqueues and pulls jobs FIFO', async () => {
    const q = createMockQueue();
    await q.producer.enqueue({
      id: '1',
      route: 'welcome',
      args: { to: 'a@b.c', input: { name: 'Ada' } },
      attempt: 0,
      enqueuedAt: 't',
    });
    const pulled = await q.consumer.pull(10, new AbortController().signal);
    expect(pulled).toHaveLength(1);
    expect(pulled[0]?.envelope.id).toBe('1');
  });

  it('ack is a no-op that resolves', async () => {
    const q = createMockQueue();
    await expect(
      q.consumer.ack({
        envelope: { id: 'a', route: 'welcome', args: {}, attempt: 0, enqueuedAt: 't' },
        raw: 'a',
      }),
    ).resolves.toBeUndefined();
  });

  it('deadLetter records to the dlq array', async () => {
    const q = createMockQueue();
    const job = {
      envelope: { id: '2', route: 'welcome', args: {}, attempt: 0, enqueuedAt: 't' },
      raw: '2',
    };
    await q.consumer.deadLetter(job, {
      status: 'dlq',
      reason: 'unknown_route',
      error: { name: 'E', code: 'CONFIG', message: 'x' },
    });
    expect(q.dlq).toHaveLength(1);
  });

  it('retry re-enqueues with incremented attempt', async () => {
    const q = createMockQueue();
    const job = {
      envelope: { id: '3', route: 'welcome', args: {}, attempt: 0, enqueuedAt: 't' },
      raw: '3',
    };
    await q.consumer.retry(job, { name: 'E', code: 'PROVIDER', message: 'x', retriable: true });
    const pulled = await q.consumer.pull(10, new AbortController().signal);
    expect(pulled[0]?.envelope.attempt).toBe(1);
  });

  it('enqueueBatch enqueues all envelopes and returns their ids', async () => {
    const q = createMockQueue();
    const envelopes = [
      { id: 'b1', route: 'welcome', args: {}, attempt: 0, enqueuedAt: 't' },
      { id: 'b2', route: 'welcome', args: {}, attempt: 0, enqueuedAt: 't' },
    ];
    const ids = await q.producer.enqueueBatch?.(envelopes);
    expect(ids).toEqual([{ id: 'b1' }, { id: 'b2' }]);
    expect(q.pending).toHaveLength(2);
  });
});

describe('createQueueProducer', () => {
  it('returns the producer object unchanged', () => {
    const producer = { enqueue: async (e: { id: string }) => ({ id: e.id }) };
    expect(createQueueProducer(producer)).toBe(producer);
  });
});

describe('createQueueConsumer', () => {
  it('returns the consumer object unchanged', () => {
    const consumer = {
      pull: async () => [],
      ack: async () => {},
      retry: async () => {},
      deadLetter: async () => {},
    };
    expect(createQueueConsumer(consumer)).toBe(consumer);
  });
});
