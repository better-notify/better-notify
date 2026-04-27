import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pushChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof pushChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('pushChannel', () => {
  it('has name "push"', () => {
    expect(pushChannel().name).toBe('push');
  });

  it('createBuilder returns a builder with _channel="push"', () => {
    const b = pushChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('push');
  });

  it('validateArgs rejects missing/empty to', () => {
    const ch = pushChannel();
    expect(() => ch.validateArgs({})).toThrow();
    expect(() => ch.validateArgs({ to: '' })).toThrow();
    expect(() => ch.validateArgs({ to: [] })).toThrow();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('validateArgs accepts string to', () => {
    const ch = pushChannel();
    expect(ch.validateArgs({ to: 'device-token-123', input: { x: 1 } })).toEqual({
      to: 'device-token-123',
      input: { x: 1 },
    });
  });

  it('validateArgs accepts array to', () => {
    const ch = pushChannel();
    expect(ch.validateArgs({ to: ['token-a', 'token-b'], input: {} })).toEqual({
      to: ['token-a', 'token-b'],
      input: {},
    });
  });

  it('render returns title, body, to from static resolvers', async () => {
    const ch = pushChannel();
    const builder = buildBuilder(ch).title('Static Title').body('Static Body');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 'token-1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ title: 'Static Title', body: 'Static Body', to: 'token-1' });
  });

  it('render returns title, body, data, badge from function resolvers', async () => {
    const ch = pushChannel();
    const builder = buildBuilder(ch)
      .title(({ input }) => `Hi ${(input as { name: string }).name}`)
      .body(({ input }) => `Welcome ${(input as { name: string }).name}`)
      .data(({ input }) => ({ user: (input as { name: string }).name }))
      .badge(({ input }) => (input as { name: string }).name.length);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 'token-1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({
      title: 'Hi Lucas',
      body: 'Welcome Lucas',
      data: { user: 'Lucas' },
      badge: 5,
      to: 'token-1',
    });
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = pushChannel();
    const mw = async () => undefined as never;
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });

  it('render passes through static data and badge values', async () => {
    const ch = pushChannel();
    const builder = buildBuilder(ch)
      .title('t')
      .body('b')
      .data({ key: 'value' })
      .badge(42);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 'token-1', input: { name: 'A' } }, {});
    expect(out).toEqual({
      title: 't',
      body: 'b',
      data: { key: 'value' },
      badge: 42,
      to: 'token-1',
    });
  });

  it('finalize throws when title is missing', () => {
    const ch = pushChannel();
    const partial = buildBuilder(ch).body('b');
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: title/);
  });

  it('finalize succeeds without optional data/badge', () => {
    const ch = pushChannel();
    const builder = buildBuilder(ch).title('t').body('b');
    const def = ch.finalize(builder, 'r');
    expect(def.id).toBe('r');
  });
});
