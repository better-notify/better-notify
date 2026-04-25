import { EmailRpcNotImplementedError } from './errors.js';
import type { AnyEmailRouter } from './router.js';
import type { Provider } from './provider.js';
import type { QueueAdapter, Worker } from './queue.js';

export interface CreateWorkerOptions<R extends AnyEmailRouter, Ctx> {
  router: R;
  provider: Provider;
  queue: QueueAdapter;
  concurrency?: number;
  context?: (params: { job: { id: string; attemptsMade: number } }) => Ctx;
}

export function createWorker<R extends AnyEmailRouter, Ctx = {}>(
  _opts: CreateWorkerOptions<R, Ctx>,
): Worker {
  throw new EmailRpcNotImplementedError('createWorker() (Layer 5)');
}
