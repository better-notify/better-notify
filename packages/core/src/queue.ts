import { EmailRpcNotImplementedError } from './errors.js'
import type { SendResult } from './types.js'

export interface EmailJob<TInput = unknown, TCtx = unknown> {
  v: 1
  route: string
  input: TInput
  context: TCtx
  meta: {
    enqueuedAt: string
    messageId: string
    tenantId?: string
  }
}

export interface QueueOptions {
  delay?: number | string
  attempts?: number
  backoff?: { type: 'exponential' | 'fixed'; delay: number }
  priority?: number
  jobId?: string
  removeOnComplete?: { age: number }
  removeOnFail?: { age: number }
}

export interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface Worker {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void
  start(): Promise<void>
  close(): Promise<void>
}

export interface QueueAdapter {
  enqueue(job: EmailJob, opts: QueueOptions): Promise<{ jobId: string }>
  process(handler: (job: EmailJob) => Promise<SendResult>): Worker
  getStats(): Promise<QueueStats>
}

export function inMemoryQueue(): QueueAdapter {
  throw new EmailRpcNotImplementedError('inMemoryQueue() (Layer 5)')
}
