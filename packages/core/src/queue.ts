import { NotifyRpcNotImplementedError } from './errors.js';
import type { SendResult } from './types.js';

export type EmailJob<TInput = unknown, TCtx = unknown> = {
  v: 1;
  route: string;
  input: TInput;
  context: TCtx;
  meta: {
    enqueuedAt: string;
    messageId: string;
    tenantId?: string;
  };
};

export type QueueOptions = {
  delay?: number | string;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  priority?: number;
  jobId?: string;
  removeOnComplete?: { age: number };
  removeOnFail?: { age: number };
};

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type Worker = {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

export type QueueAdapter = {
  enqueue(job: EmailJob, opts: QueueOptions): Promise<{ jobId: string }>;
  process(handler: (job: EmailJob) => Promise<SendResult>): Worker;
  getStats(): Promise<QueueStats>;
};

export const inMemoryQueue = (): QueueAdapter => {
  throw new NotifyRpcNotImplementedError('inMemoryQueue() (Layer 5)');
};
