import type { AnyCatalog, ChannelsOf } from '../catalog.js';
import type { AnyChannel, TransportsFor } from '../channel/types.js';
import type { Transport } from '../transport.js';
import { consoleLogger, type LoggerLike } from '../logger.js';
import { handlePromise } from '../lib/handle-promise.js';
import {
  runSendPipeline,
  normalizeHooks,
  type SendPipelineDeps,
  type ClientHooks,
} from '../pipeline.js';
import type { AnyMiddleware } from '../middlewares/types.js';
import type { Plugin } from '../plugins/types.js';
import { NotifyRpcError, NotifyRpcProviderError } from '../errors.js';
import type { JobEnvelope, JobResult, SerializedError, QueueProducer } from './types.js';

/**
 * The universal per-job brain. `process` re-validates, renders, and sends one
 * job through the shared send pipeline, returning a {@link JobResult} instead of
 * throwing — so both pull workers and push adapters consume the same outcome.
 */
export type JobProcessor = {
  process(envelope: JobEnvelope): Promise<JobResult>;
};

export type CreateJobProcessorOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  transportsByChannel: Partial<TransportsFor<ChannelsOf<R>>>;
  channels?: Partial<ChannelsOf<R>>;
  /** Rebuilds per-job context on the consumer side (the original send-time context is gone). */
  context?: (job: JobEnvelope) => Ctx | Promise<Ctx>;
  /** Lifecycle hooks; fire on the worker exactly as on a direct `.send()`. */
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
};

const serializeError = (err: NotifyRpcError): SerializedError => ({
  name: err.name,
  code: err.code,
  message: err.message,
  route: err.route,
  messageId: err.messageId,
  retriable: err instanceof NotifyRpcProviderError ? err.retriable : undefined,
});

const classify = (err: NotifyRpcError): JobResult => {
  if (err.code === 'VALIDATION')
    return { status: 'dlq', reason: 'schema_mismatch', error: serializeError(err) };
  if (err.code === 'CONFIG')
    return { status: 'dlq', reason: 'unknown_route', error: serializeError(err) };
  if (err instanceof NotifyRpcProviderError && err.retriable)
    return { status: 'retry', error: serializeError(err) };
  return { status: 'dlq', reason: 'send_failed', error: serializeError(err) };
};

/**
 * Builds a {@link JobProcessor}. Push adapters (e.g. Cloudflare Queues) call
 * `process()` directly per message; pull workers receive one internally.
 */
export const createJobProcessor = <R extends AnyCatalog, Ctx = {}>(
  opts: CreateJobProcessorOptions<R, Ctx>,
): JobProcessor => {
  const plugins = opts.plugins ?? [];
  const pluginMiddleware: AnyMiddleware[] = plugins.flatMap((p) => p?.middleware ?? []);
  const deps: SendPipelineDeps = {
    channels: (opts.channels ?? {}) as Record<string, AnyChannel>,
    transportsByChannel: opts.transportsByChannel as Record<string, Transport<unknown, unknown>>,
    hooks: normalizeHooks([...plugins.map((p) => p?.hooks as ClientHooks | undefined), opts.hooks]),
    pluginMiddleware,
    logger: (opts.logger ?? consoleLogger()).child({ component: 'worker' }),
  };

  const process = async (envelope: JobEnvelope): Promise<JobResult> => {
    const def = opts.catalog.definitions[envelope.route];
    if (!def) {
      return {
        status: 'dlq',
        reason: 'unknown_route',
        error: serializeError(
          new NotifyRpcError({
            message: `Unknown route "${envelope.route}".`,
            code: 'CONFIG',
            route: envelope.route,
          }),
        ),
      };
    }

    const [ctxErr, ctx] = await handlePromise(
      (async () => (opts.context ? opts.context(envelope) : ({} as Ctx)))(),
    );
    if (ctxErr) {
      return {
        status: 'dlq',
        reason: 'send_failed',
        error: serializeError(
          ctxErr instanceof NotifyRpcError
            ? ctxErr
            : new NotifyRpcError({
                message: ctxErr.message,
                code: 'UNKNOWN',
                route: envelope.route,
                cause: ctxErr,
              }),
        ),
      };
    }

    const [sendErr, result] = await handlePromise(
      runSendPipeline(deps, def, envelope.args, envelope.route, ctx, envelope.attempt + 1),
    );
    if (!sendErr) return { status: 'sent', messageId: result.messageId };
    const asRpc =
      sendErr instanceof NotifyRpcError
        ? sendErr
        : new NotifyRpcError({
            message: sendErr.message,
            code: 'UNKNOWN',
            route: envelope.route,
            cause: sendErr,
          });
    return classify(asRpc);
  };

  return { process };
};

/** A job pulled from the store: the decoded {@link JobEnvelope} plus the `raw` store-native handle (used to ack/delete it). */
export type PulledJob = { envelope: JobEnvelope; raw: unknown };

/**
 * Pull-side storage driver an adapter implements (Postgres, SQS, Redis, …).
 * These are imperative state transitions, not observers — each MUST move the
 * message in the store, or the queue stalls. `createQueueWorker` calls them.
 */
export type QueueConsumer = {
  /** Fetch up to `limit` jobs to process; return `[]` when the queue is empty. */
  pull(limit: number, signal: AbortSignal): Promise<PulledJob[]>;
  /** Mark a delivered job done — remove it from the queue. */
  ack(job: PulledJob): Promise<void>;
  /** Return a transiently-failed job to the queue for another attempt (typically `attempt + 1`). */
  retry(job: PulledJob, error: SerializedError): Promise<void>;
  /** Park a terminally-failed job in the dead-letter store with its outcome, out of the main queue. */
  deadLetter(job: PulledJob, result: JobResult): Promise<void>;
};

/** A running pull-loop worker. Emits `completed` (sent) and `failed` (retry or dlq) for observability. */
export type QueueWorker = {
  on(event: 'completed' | 'failed', handler: (result: JobResult, job: PulledJob) => void): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

export type CreateQueueWorkerOptions<R extends AnyCatalog, Ctx = {}> = CreateJobProcessorOptions<
  R,
  Ctx
> & {
  consumer: QueueConsumer;
  /** Max jobs pulled and processed per loop tick. Defaults to `1`. */
  concurrency?: number;
  /** Delay between polls when the queue is empty or `pull` fails. Defaults to `50`ms. */
  idleDelayMs?: number;
  /** Max delivery attempts before a retriable failure is dead-lettered. Defaults to 3. */
  maxAttempts?: number;
};

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Generic pull-loop runner for providers without their own worker (Postgres,
 * SQS, Redis). Owns concurrency, lifecycle, and events; delegates per-job logic
 * to {@link createJobProcessor} and storage transitions to the {@link QueueConsumer}.
 */
export const createQueueWorker = <R extends AnyCatalog, Ctx = {}>(
  opts: CreateQueueWorkerOptions<R, Ctx>,
): QueueWorker => {
  const processor = createJobProcessor(opts);
  const logger = (opts.logger ?? consoleLogger()).child({ component: 'worker' });
  const concurrency = opts.concurrency ?? 1;
  const idleDelayMs = opts.idleDelayMs ?? 50;
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const listeners = {
    completed: [] as Array<(r: JobResult, j: PulledJob) => void>,
    failed: [] as Array<(r: JobResult, j: PulledJob) => void>,
  };
  const controller = new AbortController();
  let running = false;
  let loopDone: Promise<void> = Promise.resolve();

  const emit = (event: 'completed' | 'failed', r: JobResult, j: PulledJob): void => {
    for (const fn of listeners[event]) fn(r, j);
  };

  const handle = async (job: PulledJob): Promise<void> => {
    const result = await processor.process(job.envelope);
    if (result.status === 'sent') {
      await opts.consumer.ack(job);
      emit('completed', result, job);
    } else if (result.status === 'retry') {
      if (job.envelope.attempt + 1 >= maxAttempts) {
        const dead: JobResult = { status: 'dlq', reason: 'retries_exhausted', error: result.error };
        await opts.consumer.deadLetter(job, dead);
        emit('failed', dead, job);
      } else {
        await opts.consumer.retry(job, result.error);
        emit('failed', result, job);
      }
    } else {
      await opts.consumer.deadLetter(job, result);
      emit('failed', result, job);
    }
  };

  const loop = async (): Promise<void> => {
    while (running) {
      const [pullErr, jobs] = await handlePromise(
        opts.consumer.pull(concurrency, controller.signal),
      );
      if (pullErr) {
        if (running) await new Promise((r) => setTimeout(r, idleDelayMs));
        continue;
      }
      if (jobs.length === 0) {
        if (running) await new Promise((r) => setTimeout(r, idleDelayMs));
        continue;
      }
      await Promise.all(
        jobs.map(async (j) => {
          const [handleErr] = await handlePromise(handle(j));
          if (handleErr) {
            logger.error('storage transition failed', { err: handleErr, jobId: j.envelope.id });
          }
        }),
      );
    }
  };

  const start = async (): Promise<void> => {
    if (running) return;
    running = true;
    loopDone = loop();
    await loopDone;
  };

  const close = async (): Promise<void> => {
    running = false;
    controller.abort();
    await loopDone;
  };

  return {
    on: (event, handler) => {
      listeners[event].push(handler);
    },
    start,
    close,
  };
};

/**
 * Typed dispatch over a map of processors keyed by queue name. Returns
 * `undefined` for unknown keys (push runtimes give `batch.queue` as a plain
 * string), forcing callers to guard rather than assume.
 */
export const createQueueRouter = <const M extends Record<string, JobProcessor>>(
  processors: M,
): { route(key: string): JobProcessor | undefined } => ({
  route: (key) => processors[key],
});

/**
 * Define a {@link QueueProducer} — the enqueue side wired into
 * `createClient({ queue })`. Returns the object unchanged; the value is DX:
 * autocomplete and inline docs for `enqueue`/`enqueueBatch` as you write the
 * adapter, instead of annotating against the type.
 *
 * @example
 * ```ts
 * const producer = createQueueProducer({
 *   enqueue: async (envelope) => {
 *     await myQueue.send(envelope);
 *     return { id: envelope.id };
 *   },
 *   enqueueBatch: async (envelopes) => {
 *     await myQueue.sendBatch(envelopes);
 *     return envelopes.map((e) => ({ id: e.id }));
 *   },
 * });
 * ```
 */
export const createQueueProducer = (producer: QueueProducer): QueueProducer => producer;

/**
 * Define a {@link QueueConsumer} — the pull-side driver an adapter implements
 * for {@link createQueueWorker} (Postgres, SQS, Redis). Returns the object
 * unchanged; provides autocomplete and inline docs for the four required
 * methods.
 *
 * @example
 * ```ts
 * const consumer = createQueueConsumer({
 *   pull: async (limit) => myStore.take(limit),
 *   ack: async (job) => myStore.remove(job.envelope.id),
 *   retry: async (job) => myStore.requeue(job.envelope),
 *   deadLetter: async (job, result) => myStore.park(job.envelope, result),
 * });
 * ```
 */
export const createQueueConsumer = (consumer: QueueConsumer): QueueConsumer => consumer;

/** In-memory queue (linked producer + consumer over heap arrays). For tests and local dev only — not durable. */
export type MockQueue = {
  producer: QueueProducer;
  consumer: QueueConsumer;
  pending: JobEnvelope[];
  dlq: Array<{ job: PulledJob; result: JobResult }>;
};

/** Creates an ephemeral {@link MockQueue}; state is lost on restart. Real persistence is the adapter's job. */
export const createMockQueue = (): MockQueue => {
  const pending: JobEnvelope[] = [];
  const dlq: Array<{ job: PulledJob; result: JobResult }> = [];
  const producer: QueueProducer = {
    enqueue: async (envelope) => {
      pending.push(envelope);
      return { id: envelope.id };
    },
    enqueueBatch: async (envelopes) => {
      pending.push(...envelopes);
      return envelopes.map((envelope) => ({ id: envelope.id }));
    },
  };
  const consumer: QueueConsumer = {
    pull: async (limit) =>
      pending.splice(0, limit).map((envelope) => ({ envelope, raw: envelope.id })),
    ack: async () => {},
    retry: async (job) => {
      pending.push({ ...job.envelope, attempt: job.envelope.attempt + 1 });
    },
    deadLetter: async (job, result) => {
      dlq.push({ job, result });
    },
  };
  return { producer, consumer, pending, dlq };
};
