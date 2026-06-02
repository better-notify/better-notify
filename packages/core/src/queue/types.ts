/**
 * JSON-safe snapshot of a {@link NotifyRpcError}, stored on failed jobs so the
 * reason a job retried or died survives the trip into a queue store or DLQ.
 */
export type SerializedError = {
  name: string;
  code: string;
  message: string;
  route?: string;
  messageId?: string;
  /** `true` only for retriable provider errors; `undefined` for terminal errors. */
  retriable?: boolean;
};

/**
 * The serializable unit of work placed on a queue. Carries everything the
 * worker needs to replay a send later — the full `.queue()` args, not just the
 * validated input.
 */
export type JobEnvelope = {
  /** Unique id for this job, used for dedup/ack/correlation. */
  id: string;
  /** Canonical dot-path route id, e.g. `"transactional.welcome"`. */
  route: string;
  /** The full send args passed to `.queue(args)` (e.g. `{ to, input }`) — replayed verbatim by the worker. */
  args: unknown;
  /** Delivery attempt count; `0` on first enqueue, incremented by the consumer on retry. */
  attempt: number;
  /** ISO-8601 timestamp of when the job was enqueued. */
  enqueuedAt: string;
};

/**
 * The outcome of processing one job, returned by the job processor. The worker
 * (or a push adapter) branches on `status` to ack, requeue, or dead-letter:
 * - `sent` — delivered; ack and forget.
 * - `retry` — transient failure; put back for another attempt.
 * - `dlq` — terminal failure; park in the dead-letter store with `reason`.
 */
export type JobResult =
  | { status: 'sent'; messageId: string }
  | {
      /**
       * Why the job is terminally dead:
       * - `schema_mismatch` — `args.input` failed re-validation.
       * - `unknown_route` — the route is not in the catalog (or has no channel).
       * - `send_failed` — a non-retriable transport/render error.
       * - `retries_exhausted` — a retriable error exceeded the worker's `maxAttempts` cap.
       */
      status: 'dlq';
      reason: 'schema_mismatch' | 'unknown_route' | 'send_failed' | 'retries_exhausted';
      error: SerializedError;
    }
  | { status: 'retry'; error: SerializedError };

/**
 * Extensible registry for provider-specific enqueue options. Adapters augment
 * this via `declare module '@betternotify/core'` to register their option type.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
export interface QueueDataMap {}

/**
 * Provider-specific options passed through to `enqueue` (e.g. delay, priority).
 * Adapters that augment {@link QueueDataMap} get typed autocomplete for their registered keys.
 */
export type EnqueueOptions = {
  [K in keyof QueueDataMap]?: QueueDataMap[K];
} & Record<string, unknown>;

/**
 * Producer side of the queue contract: hands {@link JobEnvelope}s to the
 * underlying store. Wired into `createClient({ queue })` to power `.queue()`
 * and `.queueBatch()`. Implemented per provider (BullMQ, Cloudflare, Postgres, …).
 */
export type QueueProducer = {
  enqueue(envelope: JobEnvelope, opts?: EnqueueOptions): Promise<{ id: string }>;
  /**
   * Enqueue many envelopes in one operation. Adapters with a native bulk API
   * (BullMQ `addBulk`, Cloudflare `sendBatch`) implement this; when absent, the
   * client falls back to issuing one {@link QueueProducer.enqueue} per envelope.
   */
  enqueueBatch?(envelopes: JobEnvelope[], opts?: EnqueueOptions): Promise<{ id: string }[]>;
};
