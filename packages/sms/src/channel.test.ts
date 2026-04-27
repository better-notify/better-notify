import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { smsChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof smsChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('smsChannel', () => {
  it('has name "sms"', () => {
    expect(smsChannel().name).toBe('sms');
  });

  it('createBuilder returns a builder with _channel="sms"', () => {
    const b = smsChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('sms');
  });

  it('validateArgs rejects missing/empty to', () => {
    const ch = smsChannel();
    expect(() => ch.validateArgs({})).toThrow();
    expect(() => ch.validateArgs({ to: '' })).toThrow();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('validateArgs accepts well-formed { to, input }', () => {
    const ch = smsChannel();
    expect(ch.validateArgs({ to: '+1', input: { x: 1 } })).toEqual({ to: '+1', input: { x: 1 } });
  });

  it('render returns { body, to } from a function body resolver', async () => {
    const ch = smsChannel();
    const builder = buildBuilder(ch).body(({ input }) => `Hi ${(input as { name: string }).name}`);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '+1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Hi Lucas', to: '+1' });
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = smsChannel();
    const mw = async () => undefined as never;
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });

  it('renders a static body resolver (string form)', async () => {
    const ch = smsChannel();
    const builder = buildBuilder(ch).body('Static message');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '+1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Static message', to: '+1' });
  });

  it('finalize throws when body is missing', () => {
    const ch = smsChannel();
    const partial = buildBuilder(ch);
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: body/);
  });
});
