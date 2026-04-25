export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LoggerLike = {
  debug(message: string, payload?: object): void;
  info(message: string, payload?: object): void;
  warn(message: string, payload?: object): void;
  error(message: string, payload?: object): void;
  child(bindings: object): LoggerLike;
};

export type ConsoleLoggerOptions = {
  level?: LogLevel;
};

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const serializeError = (e: unknown): unknown => {
  if (!(e instanceof Error)) return e;
  return {
    type: e.name,
    message: e.message,
    stack: e.stack,
    ...(e.cause !== undefined ? { cause: serializeError(e.cause) } : {}),
    ...((e as { code?: unknown }).code !== undefined ? { code: (e as unknown as { code: unknown }).code } : {}),
  };
};

const normalizePayload = (payload: object | undefined): object => {
  if (!payload) return {};
  const out: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
  if (out.err !== undefined) out.err = serializeError(out.err);
  return out;
};

const make = (level: LogLevel, bindings: object): LoggerLike => {
  const threshold = LEVEL_ORDER[level];
  const emit = (lvl: LogLevel, sink: (m: string, p: object) => void) =>
    (msg: string, payload?: object): void => {
      if (LEVEL_ORDER[lvl] < threshold) return;
      sink(msg, { ...bindings, ...normalizePayload(payload) });
    };
  return {
    debug: emit('debug', (m, p) => console.debug(m, p)),
    info: emit('info', (m, p) => console.info(m, p)),
    warn: emit('warn', (m, p) => console.warn(m, p)),
    error: emit('error', (m, p) => console.error(m, p)),
    child(extra) {
      return make(level, { ...bindings, ...extra });
    },
  };
};

export const consoleLogger = (opts?: ConsoleLoggerOptions): LoggerLike => {
  return make(opts?.level ?? 'warn', {});
};

type PinoLike = {
  debug(obj: object, msg: string): void;
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
  child(bindings: object): PinoLike;
};

export const fromPino = (pino: PinoLike): LoggerLike => ({
  debug: (msg, payload) => pino.debug(payload ?? {}, msg),
  info: (msg, payload) => pino.info(payload ?? {}, msg),
  warn: (msg, payload) => pino.warn(payload ?? {}, msg),
  error: (msg, payload) => pino.error(payload ?? {}, msg),
  child: (bindings) => fromPino(pino.child(bindings)),
});
