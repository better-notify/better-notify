import { NotifyRpcNotImplementedError } from '@emailrpc/core';

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

export const bullmq = (_opts: BullmqOptions): never => {
  throw new NotifyRpcNotImplementedError('@emailrpc/bullmq queue adapter (v0.3)');
};
