import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { QueueAdapter } from '@emailrpc/core/queue';

export interface BullmqOptions {
  connection: { url: string } | { host: string; port: number; password?: string };
  prefix?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: { age: number };
    removeOnFail?: { age: number };
  };
}

export function bullmq(_opts: BullmqOptions): QueueAdapter {
  throw new EmailRpcNotImplementedError('@emailrpc/bullmq queue adapter (v0.3)');
}
