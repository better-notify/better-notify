import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zapierChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof zapierChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ orderId: z.string() }));

describe('zapierChannel', () => {
  it('has name "zapier"', () => {
    expect(zapierChannel().name).toBe('zapier');
  });

  it('createBuilder returns a builder with _channel="zapier"', () => {
    const b = zapierChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('zapier');
  });

  it('validateArgs accepts { input }', () => {
    const ch = zapierChannel();
    expect(ch.validateArgs({ input: { x: 1 } })).toEqual({ input: { x: 1 } });
  });

  it('validateArgs rejects null', () => {
    const ch = zapierChannel();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('renders event and data from resolvers', async () => {
    const ch = zapierChannel();
    const builder = buildBuilder(ch)
      .event(({ input }) => `order.${input.orderId}`)
      .data(({ input }) => ({ orderId: input.orderId }));
    const def = ch.finalize(builder, 'order.created');
    const out = await ch.render(def, { input: { orderId: '123' } }, {});
    expect(out).toEqual({ event: 'order.123', data: { orderId: '123' } });
  });

  it('renders static event string', async () => {
    const ch = zapierChannel();
    const builder = buildBuilder(ch)
      .event('order.created')
      .data(({ input }) => ({ orderId: input.orderId }));
    const def = ch.finalize(builder, 'order.created');
    const out = await ch.render(def, { input: { orderId: '456' } }, {});
    expect(out).toEqual({ event: 'order.created', data: { orderId: '456' } });
  });

  it('includes meta when set', async () => {
    const ch = zapierChannel();
    const builder = buildBuilder(ch)
      .event('order.created')
      .data(() => ({ x: 1 }))
      .meta(() => ({ priority: 'high', source: 'api' }));
    const def = ch.finalize(builder, 'order.created');
    const out = await ch.render(def, { input: { orderId: '1' } }, {});
    expect(out).toEqual({ event: 'order.created', data: { x: 1 }, meta: { priority: 'high', source: 'api' } });
  });

  it('includes webhookUrl when set', async () => {
    const ch = zapierChannel();
    const builder = buildBuilder(ch)
      .event('test')
      .data(() => ({}))
      .webhookUrl('https://hooks.zapier.com/override');
    const def = ch.finalize(builder, 'test');
    const out = await ch.render(def, { input: { orderId: '1' } }, {});
    expect(out).toEqual({ event: 'test', data: {}, webhookUrl: 'https://hooks.zapier.com/override' });
  });

  it('omits optional fields when not set', async () => {
    const ch = zapierChannel();
    const builder = buildBuilder(ch)
      .event('test')
      .data(() => ({ x: 1 }));
    const def = ch.finalize(builder, 'test');
    const out = await ch.render(def, { input: { orderId: '1' } }, {});
    expect(out).not.toHaveProperty('meta');
    expect(out).not.toHaveProperty('webhookUrl');
  });

  it('finalize throws when event is missing', () => {
    const ch = zapierChannel();
    const partial = buildBuilder(ch).data(() => ({}));
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: event/);
  });

  it('finalize throws when data is missing', () => {
    const ch = zapierChannel();
    const partial = buildBuilder(ch).event('test');
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: data/);
  });
});
