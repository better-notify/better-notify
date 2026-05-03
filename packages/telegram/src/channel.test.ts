import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { telegramChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof telegramChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('telegramChannel', () => {
  it('has name "telegram"', () => {
    expect(telegramChannel().name).toBe('telegram');
  });

  it('createBuilder returns a builder with _channel="telegram"', () => {
    const b = telegramChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('telegram');
  });

  it('validateArgs rejects missing/empty to', () => {
    const ch = telegramChannel();
    expect(() => ch.validateArgs({})).toThrow();
    expect(() => ch.validateArgs({ to: '' })).toThrow();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('validateArgs accepts string to', () => {
    const ch = telegramChannel();
    expect(ch.validateArgs({ to: '123456', input: { x: 1 } })).toEqual({
      to: '123456',
      input: { x: 1 },
    });
  });

  it('validateArgs accepts numeric to', () => {
    const ch = telegramChannel();
    expect(ch.validateArgs({ to: 123456, input: { x: 1 } })).toEqual({
      to: 123456,
      input: { x: 1 },
    });
  });

  it('validateArgs rejects zero as to', () => {
    const ch = telegramChannel();
    expect(() => ch.validateArgs({ to: 0 })).toThrow();
  });

  it('render returns { body, to } from a function body resolver', async () => {
    const ch = telegramChannel();
    const builder = buildBuilder(ch).body(({ input }) => `Hi ${(input as { name: string }).name}`);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 123, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Hi Lucas', to: 123 });
  });

  it('renders a static body resolver (string form)', async () => {
    const ch = telegramChannel();
    const builder = buildBuilder(ch).body('Static message');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 123, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Static message', to: 123 });
  });

  it('render includes parseMode when set', async () => {
    const ch = telegramChannel();
    const builder = buildBuilder(ch).body('hello').parseMode('HTML');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 123, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'hello', to: 123, parseMode: 'HTML' });
  });

  it('render includes attachment when set', async () => {
    const ch = telegramChannel();
    const builder = buildBuilder(ch)
      .body('check this')
      .attachment(() => ({ type: 'photo' as const, url: 'https://example.com/img.png' }));
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 123, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({
      body: 'check this',
      to: 123,
      attachment: { type: 'photo', url: 'https://example.com/img.png' },
    });
  });

  it('finalize throws when body is missing', () => {
    const ch = telegramChannel();
    const partial = buildBuilder(ch);
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: body/);
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = telegramChannel();
    const mw = async () => undefined as never;
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });
});
