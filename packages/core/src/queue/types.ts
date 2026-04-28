/**
 * Serializable job payload stored in the queue backend.
 * All fields must be JSON-serializable — no Dates, Buffers, or functions.
 */
export type EmailJobPayload = {
  /** Protocol version — lets workers reject/DLQ payloads from incompatible schema revisions. */
  readonly _v: 1;
  /** Dot-path catalog route, e.g. "transactional.welcome". */
  readonly route: string;
  /** Validated, JSON-serializable input captured at enqueue time. */
  readonly input: unknown;
  /** Originating message ID set by the sender at enqueue time; used for tracing and idempotency. */
  readonly messageId: string;
};

/** Per-call options accepted by `.queue(input, opts)`. */
export type EnqueueOptions = {
  /** Milliseconds to delay execution from now. */
  delay?: number;
  /** Backend priority bucket. Lower values mean higher priority in BullMQ. */
  priority?: number;
  /** Caller-supplied stable job ID for deduplication across retries. */
  jobId?: string;
};

/** Return value of `.queue()` — confirms the job is durably persisted. */
export type EnqueueResult = {
  jobId: string;
  route: string;
  messageId: string;
};

/**
 * Envelope passed to the worker job handler.
 * The adapter enriches the raw payload with backend-level metadata.
 */
export type JobEnvelope = {
  payload: EmailJobPayload;
  /** 1-based attempt number, incremented by the adapter on each retry. */
  attempt: number;
  /** Backend-native job ID; matches EnqueueResult.jobId when available. */
  jobId: string;
};

/** Function signature for the worker's job handler, called once per job by the adapter. */
export type JobHandler = (job: JobEnvelope) => Promise<void>;

/**
 * QueueAdapter — the thin interface between @betternotify/core and a concrete queue backend.
 *
 * Implementations (e.g. @betternotify/bullmq) must satisfy this contract.
 * The adapter owns serialization, retry scheduling, and DLQ routing.
 */
export type QueueAdapter = {
  /**
   * Persist a job to the queue. Called by the sender's `.queue()` method.
   * Must resolve with a stable jobId once the job is durably stored.
   */
  enqueue(payload: EmailJobPayload, opts?: EnqueueOptions): Promise<EnqueueResult>;

  /**
   * Begin consuming jobs. The adapter calls `handler` for each ready job,
   * awaits the returned promise, and handles retry/DLQ on rejection.
   * Called once by `createWorker()`.
   */
  subscribe(handler: JobHandler): Promise<void>;

  /** Drain in-flight jobs and release all backend connections. */
  close(): Promise<void>;
};
