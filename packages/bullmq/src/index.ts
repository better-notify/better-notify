import { Queue, Worker as BullWorker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import type {
  QueueAdapter,
  EmailJobPayload,
  EnqueueOptions,
  EnqueueResult,
  JobHandler,
} from '@betternotify/core/queue';

/** @experimental BullMQ queue adapter — not yet implemented; ships in v0.3. */
export type BullmqOptions = {
  connection:
    | { url: string }
    | { host: string; port: number; password?: string }
    | ConnectionOptions;
  prefix?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete?: { age: number };
    removeOnFail?: { age: number };
  };
};

const QUEUE_NAME = 'betternotify';

const resolveConnection = (connection: BullmqOptions['connection']): ConnectionOptions => {
  if (typeof connection === 'object' && 'url' in connection) {
    return connection.url as unknown as ConnectionOptions;
  }
  return connection as ConnectionOptions;
};

export const bullmq = (opts: BullmqOptions): QueueAdapter => {
  const connection = resolveConnection(opts.connection);
  let queue: Queue | null = null;
  let worker: BullWorker | null = null;

  const getQueue = (): Queue => {
    if (!queue) {
      queue = new Queue(QUEUE_NAME, {
        connection,
        prefix: opts.prefix,
        defaultJobOptions: opts.defaultJobOptions,
      });
    }
    return queue;
  };

  return {
    async enqueue(payload: EmailJobPayload, jobOpts?: EnqueueOptions): Promise<EnqueueResult> {
      const q = getQueue();
      const job = await q.add(payload.route, payload, {
        delay: jobOpts?.delay,
        priority: jobOpts?.priority,
        jobId: jobOpts?.jobId,
      });
      if (!job.id) {
        throw new Error(`BullMQ enqueued job for route "${payload.route}" but returned no id`);
      }
      return {
        jobId: job.id,
        route: payload.route,
        messageId: payload.messageId,
      };
    },

    async subscribe(handler: JobHandler): Promise<void> {
      worker = new BullWorker(
        QUEUE_NAME,
        async (job) => {
          const jobId = job.id ?? '';
          await handler({
            payload: job.data as EmailJobPayload,
            attempt: job.attemptsMade + 1,
            jobId,
          });
        },
        {
          connection,
          prefix: opts.prefix,
          autorun: true,
        },
      );
      await worker.waitUntilReady();
    },

    async close(): Promise<void> {
      const closers: Promise<void>[] = [];
      if (queue) closers.push(queue.close());
      if (worker) closers.push(worker.close());
      await Promise.all(closers);
      queue = null;
      worker = null;
    },
  };
};
