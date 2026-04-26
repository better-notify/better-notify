import { handlePromise } from '../lib/handle-promise.js';
import type { EmailEvent, EmailEventError } from '../sinks/types.js';
import type { Middleware } from './types.js';
import type { WithEventLoggerOptions } from './with-event-logger.types.js';

const toEventError = (err: Error): EmailEventError => {
  const code = (err as { code?: unknown }).code;
  return {
    name: err.name,
    message: err.message,
    ...(typeof code === 'string' ? { code } : {}),
  };
};

/**
 * Emit one structured event per send into the supplied `EventSink`.
 *
 * Each send produces exactly one `EmailEvent` — either with `status: 'success'`
 * and the resolved `result`, or with `status: 'error'` and a serialized
 * `error`. Errors are re-thrown after writing so the pipeline still surfaces
 * the failure to the caller.
 *
 * Pair with `inMemoryEventSink()` for tests, `consoleEventSink()` for local
 * development, or BYO sink (Datadog, S3, Kafka, audit DB) for production.
 *
 * ```ts
 * t.use(withEventLogger({ sink: consoleEventSink() }))
 * ```
 */
export const withEventLogger = (opts: WithEventLoggerOptions): Middleware => {
  return async ({ route, messageId, next }) => {
    const startedAt = new Date();
    const start = performance.now();
    const [err, result] = await handlePromise(next());
    const durationMs = performance.now() - start;
    const endedAt = new Date();

    if (err) {
      const event: EmailEvent = {
        route,
        messageId,
        status: 'error',
        durationMs,
        startedAt,
        endedAt,
        error: toEventError(err),
      };
      await opts.sink.write(event);
      throw err;
    }

    const event: EmailEvent = {
      route,
      messageId,
      status: 'success',
      durationMs,
      startedAt,
      endedAt,
      result,
    };
    await opts.sink.write(event);
    return result;
  };
};
