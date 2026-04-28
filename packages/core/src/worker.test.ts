import { describe, it, expect, vi } from 'vitest';
import { createWorker } from './worker.js';
import { NotifyRpcError, NotifyRpcValidationError } from './errors.js';
import type { Transport } from './transports/types.js';
import type { AnyCatalog } from './catalog.js';
import type { QueueAdapter, JobEnvelope, JobHandler } from './queue/types.js';
import type { Channel } from './channel/types.js';

// Minimal fake channel that renders input as-is
const fakeChannel: Channel<'fake', any, any, any, any> = {
  name: 'fake',
  createBuilder: () => ({
    _channel: 'fake',
    _finalize: (id: string) => ({
      id,
      channel: 'fake',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'fake',
          validate: (v: unknown) => ({ value: v }),
        },
      } as any,
      middleware: [],
      runtime: {},
      _args: undefined as never,
      _rendered: undefined as never,
    }),
  }),
  finalize: (s: any, id: string) => s._finalize(id),
  validateArgs: (a: unknown) => a,
  render: vi.fn().mockResolvedValue({ html: '<p>hello</p>' }),
  _transport: undefined as never,
};

const makeCatalog = (route = 'welcome'): AnyCatalog => ({
  _brand: 'Catalog',
  _ctx: undefined as never,
  definitions: {
    [route]: {
      id: route,
      channel: 'fake',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'fake',
          validate: (v: unknown) => ({ value: v }),
        },
      } as any,
      middleware: [],
      runtime: {},
      _args: undefined as never,
      _rendered: undefined as never,
    },
  },
  nested: {},
  routes: [route],
});

const makeTransport = (): Transport & { sent: unknown[] } => {
  const sent: unknown[] = [];
  return {
    name: 'mock',
    sent,
    send: vi.fn(async (rendered) => {
      sent.push(rendered);
      return { ok: true as const, data: {} };
    }),
  };
};

// In-memory queue adapter: subscribe() registers handler; push() invokes it
const makeQueue = (): QueueAdapter & { push: (job: JobEnvelope) => Promise<void> } => {
  let subscribedHandler: JobHandler | undefined;
  return {
    async enqueue() {
      return { jobId: 'q-1', route: 'welcome', messageId: 'm-1' };
    },
    async subscribe(handler) {
      subscribedHandler = handler;
    },
    async close() {},
    async push(job: JobEnvelope) {
      if (!subscribedHandler) throw new Error('Worker not started');
      await subscribedHandler(job);
    },
  };
};

type EnvelopeOverride = { route?: string; attempt?: number; jobId?: string };

const makeEnvelope = (override: EnvelopeOverride = {}): JobEnvelope => ({
  payload: {
    _v: 1,
    route: override.route ?? 'welcome',
    input: { name: 'Alice' },
    messageId: 'msg-1',
  },
  attempt: override.attempt ?? 1,
  jobId: override.jobId ?? 'job-1',
});

describe('createWorker — happy path', () => {
  it('start() wires subscribe; job flows through render + send', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockResolvedValue({ html: '<p>hello</p>' });

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();
    await queue.push(makeEnvelope());

    expect(transport.send).toHaveBeenCalledOnce();
    expect(transport.sent[0]).toEqual({ html: '<p>hello</p>' });
  });

  it('emits completed event after successful processing', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockResolvedValue({ html: '' });

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    const completed = vi.fn();
    worker.on('completed', completed);
    await worker.start();
    await queue.push(makeEnvelope());

    expect(completed).toHaveBeenCalledOnce();
  });

  it('passes context from opts.context to channel.render', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    const renderFn = vi.fn().mockResolvedValue({ html: '' });
    vi.mocked(fakeChannel.render).mockImplementation(renderFn);

    const ctx = { requestId: 'req-abc' };
    const worker = createWorker({
      catalog,
      channels: { fake: fakeChannel },
      transport,
      queue,
      context: () => ctx,
    });
    await worker.start();
    const envelope = makeEnvelope();
    await queue.push(envelope);

    const [, , passedCtx] = renderFn.mock.calls[0] as [unknown, unknown, unknown];
    expect(passedCtx).toEqual(ctx);
  });

  it('defaults context to {} when opts.context is omitted', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    const renderFn = vi.fn().mockResolvedValue({ html: '' });
    vi.mocked(fakeChannel.render).mockImplementation(renderFn);

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();
    await queue.push(makeEnvelope());

    const [, , passedCtx] = renderFn.mock.calls[0] as [unknown, unknown, unknown];
    expect(passedCtx).toEqual({});
  });
});

describe('createWorker — validation failures (DLQ path)', () => {
  it('throws on payload._v !== 1', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    const badEnvelope: JobEnvelope = {
      payload: { _v: 99 as unknown as 1, route: 'welcome', input: {}, messageId: 'm' },
      attempt: 1,
      jobId: 'j',
    };
    await expect(queue.push(badEnvelope)).rejects.toThrow(NotifyRpcError);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('throws NotifyRpcError on unknown route', async () => {
    const catalog = makeCatalog('welcome');
    const transport = makeTransport();
    const queue = makeQueue();

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    await expect(queue.push(makeEnvelope({ route: 'no.such.route' }))).rejects.toThrow(
      NotifyRpcError,
    );
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('throws NotifyRpcValidationError when input fails schema validation', async () => {
    const failingSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (_v: unknown) => ({
          issues: [{ message: 'required', path: [{ key: 'name' }] }],
        }),
      },
    };
    const catalog: AnyCatalog = {
      _brand: 'Catalog',
      _ctx: undefined as never,
      definitions: {
        welcome: {
          id: 'welcome',
          channel: 'fake',
          schema: failingSchema as any,
          middleware: [],
          runtime: {},
          _args: undefined as never,
          _rendered: undefined as never,
        },
      },
      nested: {},
      routes: ['welcome'],
    };

    const transport = makeTransport();
    const queue = makeQueue();

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    await expect(queue.push(makeEnvelope())).rejects.toThrow(NotifyRpcValidationError);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('throws CONFIG error when channel not registered in channels map', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();

    const worker = createWorker({ catalog, channels: {}, transport, queue });
    await worker.start();

    await expect(queue.push(makeEnvelope())).rejects.toThrow(NotifyRpcError);
    expect(transport.send).not.toHaveBeenCalled();
  });
});

describe('createWorker — render failures (DLQ path)', () => {
  it('wraps render errors in NotifyRpcError with RENDER code', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockRejectedValue(new Error('template broke'));

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    const err = await queue.push(makeEnvelope()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('RENDER');
    expect(transport.send).not.toHaveBeenCalled();
  });
});

describe('createWorker — transport failures (DLQ path)', () => {
  it('throws PROVIDER error when transport.send rejects', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    vi.mocked(transport.send).mockRejectedValue(new Error('send boom'));
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockResolvedValue({ html: '' });

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    const err = await queue.push(makeEnvelope()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('throws PROVIDER error when transport.send returns { ok: false }', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    vi.mocked(transport.send).mockResolvedValue({ ok: false, error: new Error('soft fail') });
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockResolvedValue({ html: '' });

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();

    const err = await queue.push(makeEnvelope()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('emits failed event when processing fails', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const queue = makeQueue();
    vi.mocked(fakeChannel.render).mockRejectedValue(new Error('boom'));

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    const failed = vi.fn();
    worker.on('failed', failed);
    await worker.start();

    await queue.push(makeEnvelope()).catch(() => {});
    expect(failed).toHaveBeenCalledOnce();
  });
});

describe('createWorker — close', () => {
  it('close() calls queue.close()', async () => {
    const catalog = makeCatalog();
    const transport = makeTransport();
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const queue = { ...makeQueue(), close: closeSpy };

    const worker = createWorker({ catalog, channels: { fake: fakeChannel }, transport, queue });
    await worker.start();
    await worker.close();

    expect(closeSpy).toHaveBeenCalledOnce();
  });
});
