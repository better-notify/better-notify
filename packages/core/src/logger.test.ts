import { describe, expect, it, vi } from 'vitest';
import { consoleLogger } from './logger.js';

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
});
