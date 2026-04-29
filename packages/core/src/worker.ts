import { NotifyRpcNotImplementedError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { Transport } from './transports/types.js';

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export type Worker = {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export type CreateWorkerOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  transport: Transport;
  queue: unknown;
  concurrency?: number;
  context?: (params: { job: { id: string; attemptsMade: number } }) => Ctx;
};

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export const createWorker = <R extends AnyCatalog, Ctx = {}>(
  _opts: CreateWorkerOptions<R, Ctx>,
): Worker => {
  throw new NotifyRpcNotImplementedError('createWorker() (Layer 5)');
};
