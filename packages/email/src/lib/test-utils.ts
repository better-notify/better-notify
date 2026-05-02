import type { LoggerLike, LogLevel } from '@betternotify/core';

export type LogRecord = {
  level: LogLevel;
  message: string;
  bindings: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type MemoryLogger = LoggerLike & {
  readonly records: ReadonlyArray<LogRecord>;
  clear(): void;
};

const buildMemoryLogger = (
  records: LogRecord[],
  bindings: Record<string, unknown>,
): MemoryLogger => {
  const push =
    (level: LogLevel) =>
    (message: string, payload?: object): void => {
      records.push({
        level,
        message,
        bindings: { ...bindings },
        payload: { ...(payload as Record<string, unknown>) },
      });
    };
  return {
    get records() {
      return records;
    },
    clear() {
      records.length = 0;
    },
    debug: push('debug'),
    info: push('info'),
    warn: push('warn'),
    error: push('error'),
    child(extra) {
      return buildMemoryLogger(records, {
        ...bindings,
        ...(extra as Record<string, unknown>),
      });
    },
  };
};

export const memoryLogger = (): MemoryLogger => buildMemoryLogger([], {});
