import { handlePromise } from '../lib/handle-promise.js';
import { consoleLogger, type LoggerLike } from '../logger.js';
import type { EventSink, SendEvent } from './types.js';

export type CreateEventSinkOptions<TResult = unknown> = {
  write: (event: SendEvent<TResult>) => Promise<void>;
  filter?: (event: SendEvent<TResult>) => boolean;
  onError?: (err: Error, event: SendEvent<TResult>) => void;
  errorLogger?: LoggerLike;
};

/**
 * Build an `EventSink` from any write target.
 *
 * Wraps a user-supplied `write` function with two pieces of universal behavior:
 *
 * - **Failure isolation.** If `write` throws, the error is caught so a sink
 *   outage cannot break the email-send pipeline. The default behavior logs
 *   the error through `consoleLogger({ level: 'error' })` (override via
 *   `errorLogger` or take full control with `onError`).
 * - **Optional filtering.** Pass `filter: (event) => boolean` to drop events
 *   you don't want shipped (e.g. emit only `status: 'error'` to a paging
 *   pipeline).
 *
 * Use this when adapting a real backend (Datadog, Kafka, S3 NDJSON, an audit
 * DB, BigQuery) to the `EventSink` contract.
 *
 * ```ts
 * const datadogSink = createEventSink({
 *   write: async (event) => {
 *     await fetch('https://http-intake.logs.datadoghq.com/api/v2/logs', {
 *       method: 'POST',
 *       headers: { 'DD-API-KEY': process.env.DD_API_KEY!, 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ ddsource: 'betternotify', service: 'mail', ...event }),
 *     });
 *   },
 *   filter: (event) => event.status === 'error',
 * });
 * ```
 */
export const createEventSink = <TResult = unknown>(
  opts: CreateEventSinkOptions<TResult>,
): EventSink<TResult> => {
  const errorLogger = opts.errorLogger ?? consoleLogger({ level: 'error' });
  return {
    async write(event) {
      if (opts.filter && !opts.filter(event)) return;
      const [err] = await handlePromise(opts.write(event));
      if (!err) return;
      if (opts.onError) {
        opts.onError(err, event);
        return;
      }
      errorLogger.error('event sink write failed', {
        err,
        route: event.route,
        messageId: event.messageId,
      });
    },
  };
};
