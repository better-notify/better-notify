import { createEventSink } from './create-event-sink.js';
import type { EmailEvent, EventSink } from './types.js';

export type InMemoryEventSink = EventSink & {
  readonly events: ReadonlyArray<EmailEvent>;
  clear(): void;
};

/**
 * Build an in-memory `EventSink` that collects events into a readable array.
 *
 * Useful for tests and local development. Not intended for production — events
 * accumulate without bound until `clear()` is called.
 */
export const inMemoryEventSink = (): InMemoryEventSink => {
  const events: EmailEvent[] = [];
  const inner = createEventSink({
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
