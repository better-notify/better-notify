import { describe, it, expect } from 'vitest';
import { consoleEventSink } from './console-event-sink.js';
import type { LoggerLike } from '../logger.js';

const baseEvent = {
  route: 'welcome',
  messageId: 'm1',
  durationMs: 12,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  endedAt: new Date('2026-01-01T00:00:00Z'),
};

const makeLogger = (): LoggerLike & {
  calls: Array<{ level: string; msg: string; payload?: object }>;
} => {
  const calls: Array<{ level: string; msg: string; payload?: object }> = [];
  const log =
    (level: string) =>
    (msg: string, payload?: object): void => {
      calls.push({ level, msg, payload });
    };
  const logger: LoggerLike & { calls: typeof calls } = {
    calls,
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child: () => logger,
  };
  return logger;
};

describe('consoleEventSink', () => {
  it('emits success events at info level', async () => {
    const logger = makeLogger();
    const sink = consoleEventSink({ logger });
    await sink.write({ ...baseEvent, status: 'success' });
    expect(logger.calls[0]?.level).toBe('info');
    expect(logger.calls[0]?.msg).toBe('email event');
  });

  it('emits error events at error level with the err payload', async () => {
    const logger = makeLogger();
    const sink = consoleEventSink({ logger });
    await sink.write({
      ...baseEvent,
      status: 'error',
      error: { name: 'EmailRpcError', message: 'boom', code: 'PROVIDER' },
    });
    expect(logger.calls[0]?.level).toBe('error');
    expect((logger.calls[0]?.payload as { err: unknown }).err).toMatchObject({
      message: 'boom',
    });
  });
});
