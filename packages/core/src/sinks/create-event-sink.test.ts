import { describe, it, expect } from 'vitest';
import { createEventSink } from './create-event-sink.js';
import type { SendEvent } from './types.js';
import type { LoggerLike } from '../logger.js';

const baseEvent: SendEvent = {
  route: 'welcome',
  messageId: 'm1',
  status: 'success',
  durationMs: 12,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  endedAt: new Date('2026-01-01T00:00:00Z'),
};

const makeLogger = (): LoggerLike & { calls: Array<{ msg: string; payload?: object }> } => {
  const calls: Array<{ msg: string; payload?: object }> = [];
  const log = (msg: string, payload?: object): void => {
    calls.push({ msg, payload });
  };
  const logger: LoggerLike & { calls: typeof calls } = {
    calls,
    debug: log,
    info: log,
    warn: log,
    error: log,
    child: () => logger,
  };
  return logger;
};

describe('createEventSink', () => {
  it('forwards events to the user-supplied write', async () => {
    const written: SendEvent[] = [];
    const sink = createEventSink({
      write: async (event) => {
        written.push(event);
      },
    });
    await sink.write(baseEvent);
    expect(written).toEqual([baseEvent]);
  });

  it('skips events for which filter returns false', async () => {
    const written: SendEvent[] = [];
    const sink = createEventSink({
      write: async (event) => {
        written.push(event);
      },
      filter: (event) => event.status === 'error',
    });
    await sink.write(baseEvent);
    await sink.write({
      ...baseEvent,
      status: 'error',
      error: { name: 'Error', message: 'boom' },
    });
    expect(written).toHaveLength(1);
    expect(written[0]?.status).toBe('error');
  });

  it('swallows write errors and routes them to errorLogger by default', async () => {
    const errorLogger = makeLogger();
    const sink = createEventSink({
      write: async () => {
        throw new Error('sink down');
      },
      errorLogger,
    });
    await expect(sink.write(baseEvent)).resolves.toBeUndefined();
    expect(errorLogger.calls).toHaveLength(1);
    expect((errorLogger.calls[0]!.payload as { err: { message: string } }).err.message).toBe(
      'sink down',
    );
  });

  it('forwards write errors to a user onError when provided', async () => {
    const observed: Array<{ err: Error; event: SendEvent }> = [];
    const sink = createEventSink({
      write: async () => {
        throw new Error('sink down');
      },
      onError: (err, event) => {
        observed.push({ err, event });
      },
    });
    await sink.write(baseEvent);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.err.message).toBe('sink down');
  });
});
