import { createEventSink } from './create-event-sink.js';
import type { EventSink, SendEvent } from './types.js';

export type InMemoryEventSink<TResult = unknown> = EventSink<TResult> & {
  readonly events: ReadonlyArray<SendEvent<TResult>>;
  clear(): void;
};

/**
 * Build an in-memory `EventSink` that collects events into a readable array.
 *
 * Useful for tests and local development. Not intended for production — events
 * accumulate without bound until `clear()` is called.
 */
export const inMemoryEventSink = <TResult = unknown>(): InMemoryEventSink<TResult> => {
  const events: SendEvent<TResult>[] = [];
  const inner = createEventSink<TResult>({
    write: async (event) => {
      events.push(event);
    },
  });
  return {
    events,
    write: inner.write,
    clear() {
      events.length = 0;
    },
  };
};
