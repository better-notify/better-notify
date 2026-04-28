import { validate } from './schema.js';
import { NotifyRpcError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { Transport, SendContext } from './transport.js';
import type { AnyChannel, ChannelMap } from './channel/types.js';
import type { QueueAdapter, JobEnvelope } from './queue/types.js';
import { handlePromise } from './lib/handle-promise.js';

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export type Worker = {
  on(event: 'completed' | 'failed', handler: (...args: any[]) => void): void;
  start(): Promise<void>;
  close(): Promise<void>;
};

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export type CreateWorkerOptions<R extends AnyCatalog, Ctx> = {
  catalog: R;
  channels: ChannelMap;
  transport: Transport;
  queue: QueueAdapter;
  concurrency?: number;
  context?: (params: { job: JobEnvelope }) => Ctx;
};

/** @experimental Layer 5 queue worker — not yet implemented; ships in v0.3. */
export const createWorker = <R extends AnyCatalog, Ctx = {}>(
  opts: CreateWorkerOptions<R, Ctx>,
): Worker => {
  const { catalog, channels, transport, queue, context } = opts;

  const completedHandlers: Array<(...args: any[]) => void> = [];
  const failedHandlers: Array<(...args: any[]) => void> = [];

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

    const [validateErr, input] = await handlePromise(
      validate(def.schema, payload.input, { route: payload.route }),
    );
    if (validateErr) throw validateErr;

    const channel = channels[def.channel] as AnyChannel | undefined;
    if (!channel) {
      throw new NotifyRpcError({
        message: `No channel registered for "${def.channel}"`,
        code: 'CONFIG',
        route: payload.route,
        messageId: payload.messageId,
      });
    }

    const ctx = context?.({ job }) ?? ({} as Ctx);

    const [renderErr, rendered] = await handlePromise(
      channel.render(def as never, { input }, ctx),
    );
    if (renderErr) {
      throw new NotifyRpcError({
        message: `Render failed for route "${payload.route}": ${renderErr.message}`,
        code: 'RENDER',
        route: payload.route,
        messageId: payload.messageId,
        cause: renderErr,
      });
    }

    const sendCtx: SendContext = {
      route: payload.route,
      messageId: payload.messageId,
      attempt: job.attempt,
    };

    const [sendThrow, sendReturn] = await handlePromise(transport.send(rendered, sendCtx));
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
    const [err] = await handlePromise(processJob(job));
    if (err) {
      for (const h of failedHandlers) h(job, err);
      throw err;
    }
    for (const h of completedHandlers) h(job);
  };

  return {
    on(event: 'completed' | 'failed', fn: (...args: any[]) => void): void {
      if (event === 'completed') completedHandlers.push(fn);
      else failedHandlers.push(fn);
    },

    async start(): Promise<void> {
      await queue.subscribe(handler);
    },

    async close(): Promise<void> {
      await queue.close();
    },
  };
};
