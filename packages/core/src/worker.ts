import { EmailRpcNotImplementedError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { Transport } from './transports/types.js';
import type { QueueAdapter, Worker } from './queue.js';

export type CreateWorkerOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  transport: Transport;
  queue: QueueAdapter;
  concurrency?: number;
  context?: (params: { job: { id: string; attemptsMade: number } }) => Ctx;
};

export const createWorker = <R extends AnyCatalog, Ctx = {}>(
  _opts: CreateWorkerOptions<R, Ctx>,
): Worker => {
  throw new EmailRpcNotImplementedError('createWorker() (Layer 5)');
};
