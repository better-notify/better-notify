import { describe, expect, it, vi } from 'vitest';
import { consoleLogger, fromPino } from './logger.js';

const lineOf = (spy: { mock: { calls: unknown[][] } }): string => {
  const call = spy.mock.calls[0];
  if (!call) throw new Error('expected logger to have been called');
  return call[0] as string;
};

describe('consoleLogger', () => {
  it('filters below configured level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const log = consoleLogger({ level: 'warn' });
    log.info('skipped');
    log.warn('kept', { a: 1 });
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = lineOf(warnSpy);
    expect(line).toMatch(/WARN.*: kept/);
    expect(line).toContain('    a: 1');
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('defaults to warn level and emits header-only when no payload', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger();
    log.info('skip');
    log.error('keep');
    expect(infoSpy).not.toHaveBeenCalled();
    const line = lineOf(errSpy);
    expect(line).toContain('ERROR');
    expect(line).toContain(': keep');
    expect(line).not.toContain('\n');
    infoSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('renders component/route as a tag in the header', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' }).child({
      component: 'client',
      route: 'welcome',
    });
    log.error('boom');
    expect(lineOf(errSpy)).toContain('(client/welcome): boom');
    errSpy.mockRestore();
  });

  it('renders payload as indented key: value lines', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    log.error('boom', { providerName: 'mock', attempt: 2, ok: true });
    const line = lineOf(errSpy);
    expect(line).toContain('    providerName: mock');
    expect(line).toContain('    attempt: 2');
    expect(line).toContain('    ok: true');
    errSpy.mockRestore();
  });

  it('formats durationMs with ms suffix and rounds', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { durationMs: 0.766165 });
    expect(lineOf(errSpy)).toContain('durationMs: 0.77ms');
    errSpy.mockRestore();
  });

  it('truncates long messageId to last 8 chars', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', {
      messageId: 'abcdef-1234-5678-9012-345678abcdef',
    });
    expect(lineOf(errSpy)).toContain('messageId: …78abcdef');
    errSpy.mockRestore();
  });

  it('drops undefined fields', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { kept: 1, gone: undefined });
    const line = lineOf(errSpy);
    expect(line).toContain('kept: 1');
    expect(line).not.toContain('gone');
    errSpy.mockRestore();
  });

  it('renders Error with type, message, indented stack, and cause', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('inner');
    const err = new Error('outer', { cause });
    consoleLogger({ level: 'debug' }).error('failed', { err });
    const line = lineOf(errSpy);
    expect(line).toContain('Error: outer');
    expect(line).toContain('cause:');
    expect(line).toContain('Error: inner');
    expect(line).toMatch(/at .*logger\.test\.ts/);
    errSpy.mockRestore();
  });

  it('renders err.type from error class name', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    class MyErr extends Error {
      override name = 'MyErr';
    }
    consoleLogger({ level: 'debug' }).error('failed', {
      err: new MyErr('boom'),
    });
    expect(lineOf(errSpy)).toContain('MyErr: boom');
    errSpy.mockRestore();
  });

  it('falls back to "Error: " when err object has no type or message', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('failed', { err: {} });
    expect(lineOf(errSpy)).toContain('Error: ');
    errSpy.mockRestore();
  });

  it('renders err.code when set', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('boom'), { code: 'ENOENT' });
    consoleLogger({ level: 'debug' }).error('failed', { err });
    expect(lineOf(errSpy)).toContain('code: ENOENT');
    errSpy.mockRestore();
  });

  it('renders null payload value as the literal "null"', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { ratio: null });
    expect(lineOf(errSpy)).toContain('ratio: null');
    errSpy.mockRestore();
  });

  it('renders object/array payload values via inspect', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', {
      tags: ['a', 'b'],
      meta: { k: 1 },
    });
    const line = lineOf(errSpy);
    expect(line).toContain("tags: [ 'a', 'b' ]");
    expect(line).toContain('meta: { k: 1 }');
    errSpy.mockRestore();
  });

  it('formats durationMs >= 10 with no decimals', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { durationMs: 42.7 });
    expect(lineOf(errSpy)).toContain('durationMs: 43ms');
    errSpy.mockRestore();
  });

  it('does not truncate short messageId', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { messageId: 'short-id' });
    const line = lineOf(errSpy);
    expect(line).toContain('messageId: short-id');
    expect(line).not.toContain('…');
    errSpy.mockRestore();
  });

  it('passes non-Error err value through formatValue', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogger({ level: 'debug' }).error('x', { err: 'just a string' });
    expect(lineOf(errSpy)).toContain('err: just a string');
    errSpy.mockRestore();
  });
});

const makeMockPino = () => {
  const calls: Array<{ method: string; obj: object; msg: string }> = [];
  const pino: any = {
    debug: (obj: object, msg: string) => calls.push({ method: 'debug', obj, msg }),
    info: (obj: object, msg: string) => calls.push({ method: 'info', obj, msg }),
    warn: (obj: object, msg: string) => calls.push({ method: 'warn', obj, msg }),
    error: (obj: object, msg: string) => calls.push({ method: 'error', obj, msg }),
    child: (b: object) => {
      calls.push({ method: 'child', obj: b, msg: '' });
      return makeMockPino().pino;
    },
  };
  return { pino, calls };
};

describe('fromPino', () => {
  it('swaps arg order: (msg, payload) → pino(payload, msg)', () => {
    const { pino, calls } = makeMockPino();
    const log = fromPino(pino);
    log.info('msg', { a: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ method: 'info', obj: { a: 1 }, msg: 'msg' });
  });

  it('falls back payload to {} when omitted', () => {
    const { pino, calls } = makeMockPino();
    const log = fromPino(pino);
    log.info('msg');
    expect(calls[0]).toEqual({ method: 'info', obj: {}, msg: 'msg' });
  });

  it('routes debug to pino.debug with empty payload fallback', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).debug('d');
    expect(calls[0]).toEqual({ method: 'debug', obj: {}, msg: 'd' });
  });

  it('routes warn to pino.warn with empty payload fallback', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).warn('w');
    expect(calls[0]).toEqual({ method: 'warn', obj: {}, msg: 'w' });
  });

  it('routes error to pino.error with empty payload fallback', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).error('e');
    expect(calls[0]).toEqual({ method: 'error', obj: {}, msg: 'e' });
  });

  it('child calls pino.child with bindings and returns functional LoggerLike', () => {
    const { pino, calls } = makeMockPino();
    const log = fromPino(pino);
    const child = log.child({ x: 1 });
    expect(calls.some((c) => c.method === 'child' && (c.obj as any).x === 1)).toBe(true);
    expect(() => child.info('test')).not.toThrow();
  });
});

describe('consoleLogger ANSI coloring', () => {
  it('paints ANSI escape codes around output when stdout is a TTY', async () => {
    const original = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    vi.resetModules();
    try {
      const { consoleLogger } = await import('./logger.js');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const log = consoleLogger({ level: 'debug' });
      log.error('boom');
      const output = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('[');
      errSpy.mockRestore();
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true });
      vi.resetModules();
    }
  });
});
