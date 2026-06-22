import { expectTypeOf, describe, it } from 'vitest';
import { z } from 'zod';
import { defineChannel, slot } from './define-channel.js';

const buildChannel = () =>
  defineChannel({
    name: 'test' as const,
    slots: { body: slot.resolver<string>() },
    validateArgs: (args: unknown): { to: string; input: unknown } =>
      args as { to: string; input: unknown },
    render: ({ runtime, args }) => ({ body: runtime.body, to: args.to }),
  });

describe('ChannelBuilder._args with optional input', () => {
  it('omits the input key when .input() is never called', () => {
    const builder = buildChannel().createBuilder({ ctx: undefined, rootMiddleware: [] }).body('hi');
    expectTypeOf<typeof builder._args>().toEqualTypeOf<{ to: string }>();
  });

  it('requires the typed input key once .input() is called', () => {
    const builder = buildChannel()
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ name: z.string() }))
      .body('hi');
    expectTypeOf<typeof builder._args>().toEqualTypeOf<
      { to: string } & { input: { name: string } }
    >();
  });
});
