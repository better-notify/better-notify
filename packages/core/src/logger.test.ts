import { describe, expect, it, vi } from 'vitest';
import { consoleLogger, fromPino } from './logger.js';

describe('consoleLogger', () => {
  it('filters below configured level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const log = consoleLogger({ level: 'warn' });
    log.info('skipped');
    log.warn('kept', { a: 1 });
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('kept', { a: 1 });
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('defaults to warn level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger();
    log.info('skip');
    log.error('keep');
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith('keep', {});
    infoSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('child merges bindings into every payload', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    const child = log.child({ route: 'welcome' }).child({ messageId: 'abc' });
    child.error('boom', { extra: true });
    expect(errSpy).toHaveBeenCalledWith('boom', { route: 'welcome', messageId: 'abc', extra: true });
    errSpy.mockRestore();
  });

  it('formats Error in err payload with stack and cause', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    const cause = new Error('inner');
    const err = new Error('outer', { cause });
    log.error('failed', { err });
    expect(errSpy).toHaveBeenCalledTimes(1);
    const [msg, payload] = errSpy.mock.calls[0]!;
    expect(msg).toBe('failed');
    expect((payload as any).err.message).toBe('outer');
    expect((payload as any).err.stack).toContain('outer');
    expect((payload as any).err.cause.message).toBe('inner');
    errSpy.mockRestore();
  });

  it('serializes err.type from error class name', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    class MyErr extends Error {
      override name = 'MyErr';
    }
    const err = new MyErr('boom');
    log.error('failed', { err });
    const [, payload] = errSpy.mock.calls[0]!;
    expect((payload as any).err.type).toBe('MyErr');
    errSpy.mockRestore();
  });

  it('includes code when set on the error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    const err = Object.assign(new Error('boom'), { code: 'ENOENT' });
    log.error('failed', { err });
    const [, payload] = errSpy.mock.calls[0]!;
    expect((payload as any).err.code).toBe('ENOENT');
    errSpy.mockRestore();
  });

  it('omits code when not set on the error', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    const err = new Error('x');
    log.error('failed', { err });
    const [, payload] = errSpy.mock.calls[0]!;
    expect('code' in (payload as any).err).toBe(false);
    errSpy.mockRestore();
  });

  it('passes non-Error err value through unchanged', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = consoleLogger({ level: 'debug' });
    log.error('x', { err: 'just a string' });
    const [, payload] = errSpy.mock.calls[0]!;
    expect((payload as any).err).toBe('just a string');
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

  it('routes debug to pino.debug', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).debug('d', { x: 1 });
    expect(calls[0]!.method).toBe('debug');
  });

  it('routes warn to pino.warn', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).warn('w', { x: 2 });
    expect(calls[0]!.method).toBe('warn');
  });

  it('routes error to pino.error', () => {
    const { pino, calls } = makeMockPino();
    fromPino(pino).error('e', { x: 3 });
    expect(calls[0]!.method).toBe('error');
  });

  it('child calls pino.child with bindings and returns functional LoggerLike', () => {
    const { pino, calls } = makeMockPino();
    const log = fromPino(pino);
    const child = log.child({ x: 1 });
    expect(calls.some((c) => c.method === 'child' && (c.obj as any).x === 1)).toBe(true);
    expect(() => child.info('test')).not.toThrow();
  });
});
