import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { QueueAdapter } from '@betternotify/core/queue';

/** @experimental BullMQ queue adapter — not yet implemented; ships in v0.3. */
export type BullmqOptions = {
  connection: { url: string } | { host: string; port: number; password?: string };
  prefix?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: { age: number };
    removeOnFail?: { age: number };
  };
};

/** @experimental BullMQ queue adapter — not yet implemented; ships in v0.3. */
export const bullmq = (_opts: BullmqOptions): QueueAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/bullmq queue adapter (v0.3)');
};
