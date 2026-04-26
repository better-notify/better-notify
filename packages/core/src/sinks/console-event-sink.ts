import { consoleLogger, type LoggerLike } from '../logger.js';
import { createEventSink } from './create-event-sink.js';
import type { EventSink } from './types.js';

export type ConsoleEventSinkOptions = {
  logger?: LoggerLike;
};

/**
 * Build an `EventSink` that emits each event through a structured logger.
 *
 * Defaults to `consoleLogger({ level: 'info' })`. Pass a `logger` (anything
 * matching `LoggerLike`, including a pino instance via `fromPino`) to route
 * events into your existing log pipeline.
 */
export const consoleEventSink = (opts: ConsoleEventSinkOptions = {}): EventSink => {
  const logger = opts.logger ?? consoleLogger({ level: 'info' });
  return createEventSink({
    write: async (event) => {
      const payload = {
        route: event.route,
        messageId: event.messageId,
        status: event.status,
        durationMs: event.durationMs,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        ...(event.error ? { err: event.error } : {}),
        ...(event.result ? { result: event.result } : {}),
      };
      if (event.status === 'error') {
        logger.error('email event', payload);
      } else {
        logger.info('email event', payload);
      }
    },
  });
};
