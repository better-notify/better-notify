import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmailJobPayload } from '@betternotify/core/queue';

const mockJobAdd = vi.fn();
const mockQueueClose = vi.fn();
const mockWorkerClose = vi.fn();
const mockWaitUntilReady = vi.fn().mockResolvedValue(undefined);

let capturedProcessor:
  | ((job: { data: unknown; id: string; attemptsMade: number }) => Promise<void>)
  | undefined;

vi.mock('bullmq', () => {
  class FakeQueue {
    add = mockJobAdd;
    close = mockQueueClose;
  }
  class FakeWorker {
    waitUntilReady = mockWaitUntilReady;
    close = mockWorkerClose;
    constructor(
      _name: string,
      processor: (job: { data: unknown; id: string; attemptsMade: number }) => Promise<void>,
    ) {
      capturedProcessor = processor;
    }
  }
  return { Queue: FakeQueue, Worker: FakeWorker };
});

const { bullmq } = await import('./index.js');

const baseConnection = { host: 'localhost', port: 6379 };

const makePayload = (route = 'test.send'): EmailJobPayload => ({
  _v: 1,
  route,
  input: { name: 'Alice' },
  messageId: 'msg-1',
});

beforeEach(() => {
  vi.clearAllMocks();
  capturedProcessor = undefined;
  mockJobAdd.mockResolvedValue({ id: 'job-42' });
  mockQueueClose.mockResolvedValue(undefined);
  mockWorkerClose.mockResolvedValue(undefined);
  mockWaitUntilReady.mockResolvedValue(undefined);
});

describe('bullmq() — enqueue', () => {
  it('calls queue.add() with the payload and returns EnqueueResult', async () => {
    const adapter = bullmq({ connection: baseConnection });
    const payload = makePayload();
    const result = await adapter.enqueue(payload);

    expect(mockJobAdd).toHaveBeenCalledOnce();
    const [jobName, jobData] = mockJobAdd.mock.calls[0] as [string, unknown];
    expect(jobName).toBe('test.send');
    expect(jobData).toEqual(payload);

    expect(result).toEqual({
      jobId: 'job-42',
      route: 'test.send',
      messageId: 'msg-1',
    });
  });

  it('passes delay, priority, jobId from EnqueueOptions to queue.add()', async () => {
    const adapter = bullmq({ connection: baseConnection });
    await adapter.enqueue(makePayload(), { delay: 5000, priority: 2, jobId: 'custom-id' });

    const [, , opts] = mockJobAdd.mock.calls[0] as [string, unknown, Record<string, unknown>];
    expect(opts).toMatchObject({ delay: 5000, priority: 2, jobId: 'custom-id' });
  });

  it('throws when BullMQ returns no job id', async () => {
    mockJobAdd.mockResolvedValue({ id: undefined });
    const adapter = bullmq({ connection: baseConnection });
    await expect(adapter.enqueue(makePayload())).rejects.toThrow(
      'BullMQ enqueued job for route "test.send" but returned no id',
    );
  });
});

describe('bullmq() — subscribe', () => {
  it('creates a Worker and calls waitUntilReady()', async () => {
    const adapter = bullmq({ connection: baseConnection });
    const handler = vi.fn().mockResolvedValue(undefined);
    await adapter.subscribe(handler);

    expect(mockWaitUntilReady).toHaveBeenCalledOnce();
  });

  it('calls the handler with a JobEnvelope when the worker processes a job', async () => {
    const adapter = bullmq({ connection: baseConnection });
    const handler = vi.fn().mockResolvedValue(undefined);
    await adapter.subscribe(handler);

    const payload = makePayload();
    await capturedProcessor!({ data: payload, id: 'job-1', attemptsMade: 0 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      payload,
      attempt: 1,
      jobId: 'job-1',
    });
  });

  it('increments attempt correctly (attemptsMade is 0-based)', async () => {
    const adapter = bullmq({ connection: baseConnection });
    const handler = vi.fn().mockResolvedValue(undefined);
    await adapter.subscribe(handler);

    const payload = makePayload();
    await capturedProcessor!({ data: payload, id: 'j', attemptsMade: 2 });
    const envelope = (handler.mock.calls[0] as [{ attempt: number }])[0];
    expect(envelope.attempt).toBe(3);
  });

  it('propagates handler rejection so BullMQ can handle retry/DLQ', async () => {
    const adapter = bullmq({ connection: baseConnection });
    const boom = new Error('process failed');
    const handler = vi.fn().mockRejectedValue(boom);
    await adapter.subscribe(handler);

    await expect(
      capturedProcessor!({ data: makePayload(), id: 'j', attemptsMade: 0 }),
    ).rejects.toThrow('process failed');
  });
});

describe('bullmq() — close', () => {
  it('calls close on both queue and worker when both exist', async () => {
    const adapter = bullmq({ connection: baseConnection });
    await adapter.enqueue(makePayload());
    await adapter.subscribe(vi.fn());
    await adapter.close();

    expect(mockQueueClose).toHaveBeenCalledOnce();
    expect(mockWorkerClose).toHaveBeenCalledOnce();
  });

  it('skips worker close when only queue was created', async () => {
    const adapter = bullmq({ connection: baseConnection });
    await adapter.enqueue(makePayload());
    await expect(adapter.close()).resolves.toBeUndefined();
    expect(mockQueueClose).toHaveBeenCalledOnce();
    expect(mockWorkerClose).not.toHaveBeenCalled();
  });

  it('is safe to call before any use', async () => {
    const adapter = bullmq({ connection: baseConnection });
    await expect(adapter.close()).resolves.toBeUndefined();
    expect(mockQueueClose).not.toHaveBeenCalled();
    expect(mockWorkerClose).not.toHaveBeenCalled();
  });
});

describe('bullmq() — connection variants', () => {
  it('accepts url-based connection', async () => {
    const adapter = bullmq({ connection: { url: 'redis://localhost:6379' } });
    await adapter.enqueue(makePayload());
    expect(mockJobAdd).toHaveBeenCalledOnce();
  });

  it('accepts host/port/password connection', async () => {
    const adapter = bullmq({
      connection: { host: '127.0.0.1', port: 6380, password: 'secret' },
    });
    await adapter.enqueue(makePayload());
    expect(mockJobAdd).toHaveBeenCalledOnce();
  });
});
