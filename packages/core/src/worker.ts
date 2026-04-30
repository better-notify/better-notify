import { validate } from './schema.js';
import { NotifyRpcError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { Transport, SendContext } from './transport.js';
import type { AnyChannel, ChannelMap } from './channel/types.js';
import type { QueueAdapter, JobEnvelope } from './queue/types.js';
import { handlePromise } from './lib/handle-promise.js';

/**
 * A running notification worker. Call {@link Worker.start | `start()`} to begin consuming jobs
 * and {@link Worker.close | `close()`} to shut down. Subscribe to `'completed'` and `'failed'`
 * lifecycle events via {@link Worker.on | `on()`}.
 */
export type Worker = {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void | Promise<void>): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

/**
 * Options for {@link createWorker}.
 *
 * @typeParam R - The notification catalog.
 * @typeParam Ctx - Per-job context type produced by the `context` factory.
 */
export type CreateWorkerOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  channels: ChannelMap;
  transport: Transport;
  queue: QueueAdapter;
  context?: (params: { job: JobEnvelope }) => Ctx;
};

/**
 * Creates a queue-backed notification worker that validates, renders, and sends
 * each dequeued job through the provided catalog, channels, and transport.
 *
 * @typeParam R - Catalog type to serve.
 * @typeParam Ctx - Per-job context type returned by `opts.context`.
 */
export const createWorker = <R extends AnyCatalog, Ctx = {}>(
  opts: CreateWorkerOptions<R, Ctx>,
): Worker => {
  const { catalog, channels, transport, queue, context } = opts;

  const completedHandlers: Array<(...args: any[]) => void> = [];
  const failedHandlers: Array<(...args: any[]) => void> = [];
  let startPromise: Promise<void> | null = null;

  const processJob = async (job: JobEnvelope): Promise<void> => {
    const { payload } = job;

    if (payload._v !== 1) {
      throw new NotifyRpcError({
        message: `Unsupported job payload version: ${(payload as { _v: unknown })._v}`,
        code: 'VALIDATION',
        route: payload.route,
        messageId: payload.messageId,
      });
    }

    const def = catalog.definitions[payload.route];
    if (!def) {
      throw new NotifyRpcError({
        message: `No catalog definition found for route "${payload.route}"`,
        code: 'CONFIG',
        route: payload.route,
        messageId: payload.messageId,
      });
    }

    const validateTuple = await handlePromise(
      validate(def.schema, payload.input, { route: payload.route }),
    );
    if (validateTuple[0]) throw validateTuple[0];

    const channel = channels[def.channel] as AnyChannel | undefined;
    if (!channel) {
      throw new NotifyRpcError({
        message: `No channel registered for "${def.channel}"`,
        code: 'CONFIG',
        route: payload.route,
        messageId: payload.messageId,
      });
    }

    let ctx: Ctx;
    try {
      ctx = context?.({ job }) ?? ({} as Ctx);
    } catch (e) {
      const ctxErr = e instanceof Error ? e : new Error(String(e));
      throw new NotifyRpcError({
        message: `Context factory threw for route "${payload.route}": ${ctxErr.message}`,
        code: 'CONFIG',
        route: payload.route,
        messageId: payload.messageId,
        cause: ctxErr,
      });
    }

    const renderTuple = await handlePromise(
      Promise.resolve().then(() => channel.render(def as never, { input: validateTuple[1] }, ctx)),
    );
    const renderErr = renderTuple[0];
    if (renderErr) {
      throw new NotifyRpcError({
        message: `Render failed for route "${payload.route}": ${renderErr.message}`,
        code: 'RENDER',
        route: payload.route,
        messageId: payload.messageId,
        cause: renderErr,
      });
    }
    const rendered = renderTuple[1];

    const sendCtx: SendContext = {
      route: payload.route,
      messageId: payload.messageId,
      attempt: job.attempt,
    };

    const sendTuple = await handlePromise(
      Promise.resolve().then(() => transport.send(rendered, sendCtx)),
    );
    const sendThrow = sendTuple[0];
    const sendReturn = sendTuple[1];
    const failure: Error | null = sendThrow
      ? sendThrow
      : sendReturn && sendReturn.ok === false
        ? sendReturn.error
        : null;
    if (failure) {
      throw failure instanceof NotifyRpcError
        ? failure
        : new NotifyRpcError({
            message: `Transport send failed for route "${payload.route}": ${failure.message}`,
            code: 'PROVIDER',
            route: payload.route,
            messageId: payload.messageId,
            cause: failure,
          });
    }
  };

  const handler = async (job: JobEnvelope): Promise<void> => {
    const processTuple = await handlePromise(processJob(job));
    const err = processTuple[0];
    if (err) {
      for (const h of failedHandlers) {
        await handlePromise(Promise.resolve().then(() => h(job, err)));
      }
      throw err;
    }
    for (const h of completedHandlers) {
      await handlePromise(Promise.resolve().then(() => h(job)));
    }
  };

  return {
    on(event: 'completed' | 'failed', fn: (...args: any[]) => void): void {
      if (event === 'completed') completedHandlers.push(fn);
      else failedHandlers.push(fn);
    },

    async start(): Promise<void> {
      if (!startPromise) {
        startPromise = queue.subscribe(handler).catch((err) => {
          startPromise = null;
          throw err;
        });
      }
      await startPromise;
    },

    async close(): Promise<void> {
      await queue.close();
    },
  };
};
