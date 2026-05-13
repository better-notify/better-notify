import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { webPushChannel } from './channel.js';

const sub = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: { p256dh: 'BNcRdreALRFXTkOOUH-test', auth: 'tBHItJI5svbpC7HQ' },
});

const buildBuilder = (ch: ReturnType<typeof webPushChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('webPushChannel', () => {
  it('has name "webpush"', () => {
    expect(webPushChannel().name).toBe('webpush');
  });

  it('createBuilder returns a builder with _channel="webpush"', () => {
    const b = webPushChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('webpush');
  });

  it('validateArgs rejects missing/invalid to', () => {
    const ch = webPushChannel();
    expect(() => ch.validateArgs({})).toThrow();
    expect(() => ch.validateArgs({ to: '' })).toThrow();
    expect(() => ch.validateArgs({ to: [] })).toThrow();
    expect(() => ch.validateArgs(null)).toThrow();
    expect(() => ch.validateArgs({ to: 'not-a-subscription' })).toThrow();
    expect(() => ch.validateArgs({ to: { endpoint: 'x' } })).toThrow();
  });

  it('validateArgs rejects empty endpoint', () => {
    const ch = webPushChannel();
    expect(() =>
      ch.validateArgs({ to: { endpoint: '', keys: { p256dh: 'a', auth: 'b' } } }),
    ).toThrow('endpoint must be non-empty');
  });

  it('validateArgs rejects array with invalid items', () => {
    const ch = webPushChannel();
    expect(() => ch.validateArgs({ to: [{ endpoint: 'x' }] })).toThrow(
      'subscription objects with endpoint and keys',
    );
  });

  it('validateArgs accepts single subscription', () => {
    const ch = webPushChannel();
    const s = sub();
    expect(ch.validateArgs({ to: s, input: { x: 1 } })).toEqual({
      to: s,
      input: { x: 1 },
    });
  });

  it('validateArgs accepts array of subscriptions', () => {
    const ch = webPushChannel();
    const subs = [sub('https://a.com/1'), sub('https://b.com/2')];
    expect(ch.validateArgs({ to: subs, input: {} })).toEqual({
      to: subs,
      input: {},
    });
  });

  it('render returns title, body, to from static resolvers', async () => {
    const ch = webPushChannel();
    const builder = buildBuilder(ch).title('Static Title').body('Static Body');
    const def = ch.finalize(builder, 'greet');
    const s = sub();
    const out = await ch.render(def, { to: s, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ title: 'Static Title', body: 'Static Body', to: s });
  });

  it('render returns all optional fields from function resolvers', async () => {
    const ch = webPushChannel();
    const builder = buildBuilder(ch)
      .title(({ input }) => `Hi ${(input as { name: string }).name}`)
      .body(({ input }) => `Welcome ${(input as { name: string }).name}`)
      .icon('/icon.png')
      .badge('/badge.png')
      .image('/hero.jpg')
      .tag('greeting')
      .data(({ input }) => ({ user: (input as { name: string }).name }))
      .actions([{ action: 'open', title: 'Open' }]);
    const def = ch.finalize(builder, 'greet');
    const s = sub();
    const out = await ch.render(def, { to: s, input: { name: 'Lucas' } }, {});
    expect(out).toEqual({
      title: 'Hi Lucas',
      body: 'Welcome Lucas',
      icon: '/icon.png',
      badge: '/badge.png',
      image: '/hero.jpg',
      tag: 'greeting',
      data: { user: 'Lucas' },
      actions: [{ action: 'open', title: 'Open' }],
      to: s,
    });
  });

  it('finalize throws when title is missing', () => {
    const ch = webPushChannel();
    const partial = buildBuilder(ch).body('b');
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: title/);
  });

  it('finalize succeeds without optional slots', () => {
    const ch = webPushChannel();
    const builder = buildBuilder(ch).title('t').body('b');
    const def = ch.finalize(builder, 'r');
    expect(def.id).toBe('r');
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = webPushChannel();
    const mw = async () => undefined as never;
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });
});
