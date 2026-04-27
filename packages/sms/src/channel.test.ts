import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { smsChannel } from './channel.js';
import { createSmsBuilder } from './builder.js';

describe('smsChannel', () => {
  it('has name "sms"', () => {
    expect(smsChannel().name).toBe('sms');
  });

  it('createBuilder returns an SmsBuilder with _channel="sms"', () => {
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

  it('render returns { body, to } from body resolver', async () => {
    const ch = smsChannel();
    const builder = createSmsBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .body(({ input }) => `Hi ${input.name}`);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '+1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Hi Lucas', to: '+1' });
  });
});
