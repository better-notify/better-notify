import { NotifyRpcNotImplementedError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { Transport } from './transports/types.js';

export type Worker = {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

export type CreateWorkerOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  transport: Transport;
  queue: unknown;
  concurrency?: number;
  context?: (params: { job: { id: string; attemptsMade: number } }) => Ctx;
};

export const createWorker = <R extends AnyCatalog, Ctx = {}>(
  _opts: CreateWorkerOptions<R, Ctx>,
): Worker => {
  throw new NotifyRpcNotImplementedError('createWorker() (Layer 5)');
};
