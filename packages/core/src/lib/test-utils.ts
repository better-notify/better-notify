import { EmailRpcNotImplementedError } from '../errors.js';
import type { LoggerLike, LogLevel } from '../logger.js';
import type { Transport } from '../transports/types.js';
import type { AnyCatalog } from '../catalog.js';
import type { Sender } from '../sender.js';

export type CreateTestSenderOptions<R extends AnyCatalog> = {
  router: R;
  transport: Transport;
  hooks?: HookRecorder;
};

export const createTestSender = <R extends AnyCatalog>(
  _opts: CreateTestSenderOptions<R>,
): Sender<R> => {
  throw new EmailRpcNotImplementedError('createTestSender() (Layer 2 test utilities)');
};

export type HookRecorder = {
  readonly calls: Array<{ name: string; route: string; [k: string]: unknown }>;
  reset(): void;
};

export const recordHooks = (): HookRecorder => {
  throw new EmailRpcNotImplementedError('recordHooks() (Layer 2 test utilities)');
};

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
        payload: { ...((payload as Record<string, unknown>) ?? {}) },
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
