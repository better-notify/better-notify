import { inspect } from 'node:util';

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

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const serializeError = (e: unknown): unknown => {
  if (!(e instanceof Error)) return e;
  return {
    type: e.name,
    message: e.message,
    stack: e.stack,
    ...(e.cause !== undefined ? { cause: serializeError(e.cause) } : {}),
    ...((e as { code?: unknown }).code !== undefined
      ? { code: (e as unknown as { code: unknown }).code }
      : {}),
  };
};

const normalizePayload = (payload: object | undefined): Record<string, unknown> => {
  if (!payload) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = k === 'err' ? serializeError(v) : v;
  }
  return out;
};

const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
};

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.gray,
  info: ANSI.cyan,
  warn: ANSI.yellow,
  error: ANSI.red,
};

const useColor = typeof process !== 'undefined' && process.stdout?.isTTY === true;

const paint = (color: string, text: string): string =>
  useColor ? `${color}${text}${ANSI.reset}` : text;

const formatTime = (d: Date): string => {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
};

const formatValue = (key: string, value: unknown): string => {
  if (key === 'durationMs' && typeof value === 'number') {
    return `${value < 10 ? value.toFixed(2) : value.toFixed(0)}ms`;
  }
  if (key === 'messageId' && typeof value === 'string' && value.length > 12) {
    return `…${value.slice(-8)}`;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return inspect(value, {
    colors: false,
    depth: 4,
    breakLength: Infinity,
    compact: true,
  });
};

const renderError = (err: unknown): string[] => {
  if (!err || typeof err !== 'object') return [`    err: ${formatValue('err', err)}`];
  const e = err as Record<string, unknown>;
  const lines: string[] = [];
  const head = paint(ANSI.red, `${e.type ?? 'Error'}: ${e.message ?? ''}`);
  lines.push(`    err: ${head}`);
  if (e.code !== undefined) lines.push(`        code: ${formatValue('code', e.code)}`);
  if (typeof e.stack === 'string') {
    for (const stackLine of e.stack.split('\n').slice(1)) {
      lines.push(paint(ANSI.dim, `        ${stackLine.trim()}`));
    }
  }
  if (e.cause !== undefined) {
    lines.push('    cause:');
    for (const causeLine of renderError(e.cause)) {
      lines.push(`    ${causeLine}`);
    }
  }
  return lines;
};

const formatLine = (level: LogLevel, msg: string, data: Record<string, unknown>): string => {
  const time = paint(ANSI.dim, `[${formatTime(new Date())}]`);
  const lvl = paint(LEVEL_COLOR[level], level.toUpperCase().padEnd(5));
  const { component, route, ...rest } = data;
  const tag = [component, route].filter((x) => typeof x === 'string' && x.length > 0).join('/');
  const name = tag ? paint(ANSI.cyan, ` (${tag})`) : '';
  const header = `${time} ${lvl}${name}: ${msg}`;
  const lines: string[] = [];
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'err') {
      for (const errLine of renderError(v)) lines.push(errLine);
      continue;
    }
    lines.push(`    ${paint(ANSI.dim, k + ':')} ${formatValue(k, v)}`);
  }
  return lines.length > 0 ? `${header}\n${lines.join('\n')}` : header;
};

const make = (level: LogLevel, bindings: object): LoggerLike => {
  const threshold = LEVEL_ORDER[level];
  const emit =
    (lvl: LogLevel, sink: (line: string) => void) =>
    (msg: string, payload?: object): void => {
      if (LEVEL_ORDER[lvl] < threshold) return;
      const merged = stripUndefined({
        ...(bindings as Record<string, unknown>),
        ...normalizePayload(payload),
      });
      sink(formatLine(lvl, msg, merged));
    };
  return {
    debug: emit('debug', (l) => console.debug(l)),
    info: emit('info', (l) => console.info(l)),
    warn: emit('warn', (l) => console.warn(l)),
    error: emit('error', (l) => console.error(l)),
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
