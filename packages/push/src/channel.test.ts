import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pushChannel } from './channel.js';
import { createPushBuilder } from './builder.js';

describe('pushChannel', () => {
  it('has name "push"', () => {
    expect(pushChannel().name).toBe('push');
  });

  it('createBuilder returns a PushBuilder with _channel="push"', () => {
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
    const builder = createPushBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .title('Static Title')
      .body('Static Body');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: 'token-1', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ title: 'Static Title', body: 'Static Body', to: 'token-1' });
  });

  it('render returns title, body, data, badge from function resolvers', async () => {
    const ch = pushChannel();
    const builder = createPushBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .title(({ input }) => `Hi ${input.name}`)
      .body(({ input }) => `Welcome ${input.name}`)
      .data(({ input }) => ({ user: input.name }))
      .badge(({ input }) => input.name.length);
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
});
