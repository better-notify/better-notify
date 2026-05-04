import { expectTypeOf, describe, it } from 'vitest';
import { z } from 'zod';
import { zapierChannel } from './channel.js';

describe('zapierChannel type constraints', () => {
  it('unconstrained channel accepts any string event', () => {
    const ch = zapierChannel();
    const builder = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }));

    expectTypeOf(builder.event).parameter(0).toMatchTypeOf<string | ((...args: any[]) => string)>();
  });

  it('constrained channel narrows event to union', () => {
    const ch = zapierChannel<'a' | 'b'>();
    const builder = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }));

    expectTypeOf(builder.event).parameter(0).toMatchTypeOf<'a' | 'b' | ((...args: any[]) => 'a' | 'b')>();
  });

  it('constrained channel rejects invalid event string', () => {
    const ch = zapierChannel<'order.created' | 'order.cancelled'>();
    const builder = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }));

    // @ts-expect-error — 'invalid.event' is not in the union
    builder.event('invalid.event');
  });
});
