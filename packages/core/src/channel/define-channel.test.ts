import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineChannel, slot } from './define-channel.js';
import type { ChannelDefinition } from './types.js';

type TestArgs = { to: string; input: unknown };
type TestRendered = { body: string; to: string };

const buildSimpleChannel = () =>
  defineChannel({
    name: 'test' as const,
    slots: {
      body: slot.resolver<string>(),
      tag: slot.value<string>(),
    },
    validateArgs: (args: unknown): TestArgs => {
      const a = args as Record<string, unknown>;
      if (typeof a.to !== 'string') throw new Error('to required');
      return a as TestArgs;
    },
    render: ({ runtime, args }): TestRendered => {
      const body = typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body;
      return { body, to: args.to };
    },
  });

describe('defineChannel', () => {
  it('creates a channel with name and a builder factory', () => {
    const ch = buildSimpleChannel();
    expect(ch.name).toBe('test');
    expect(typeof ch.createBuilder).toBe('function');
  });

  it('builder.input() throws on double-set', () => {
    const ch = buildSimpleChannel();
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [] });
    const b2 = b.input(z.object({ x: z.string() }));
    expect(() => b2.input(z.object({ y: z.string() }))).toThrow(/already set/);
  });

  it('slot setter throws on double-set', () => {
    const ch = buildSimpleChannel();
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).body('hi');
    expect(() => b.body('again' as never)).toThrow(/already set/);
  });

  it('_finalize throws when input slot is missing', () => {
    const ch = buildSimpleChannel();
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect(() => b._finalize('r1')).toThrow(/missing required slot: input/);
  });

  it('_finalize throws when a declared slot is missing', () => {
    const ch = buildSimpleChannel();
    const b = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }))
      .body('hi');
    expect(() => b._finalize('r1')).toThrow(/missing required slot: tag/);
  });

  it('_finalize returns a definition when all slots are set', () => {
    const ch = buildSimpleChannel();
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }))
      .body('hello')
      .tag('marketing')
      ._finalize('r1');
    expect(def.id).toBe('r1');
    expect(def.channel).toBe('test');
    expect(def.runtime).toMatchObject({ body: 'hello', tag: 'marketing' });
    expect(def.middleware).toEqual([]);
  });

  it('builder.use() appends middleware', () => {
    const ch = buildSimpleChannel();
    const mw1 = async () => undefined as never;
    const mw2 = async () => undefined as never;
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .use(mw1 as never)
      .input(z.object({ x: z.string() }))
      .use(mw2 as never)
      .body('hi')
      .tag('m')
      ._finalize('r1');
    expect(def.middleware).toEqual([mw1, mw2]);
  });

  it('createBuilder seeds rootMiddleware', () => {
    const ch = buildSimpleChannel();
    const root = async () => undefined as never;
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [root as never] })
      .input(z.object({ x: z.string() }))
      .body('hi')
      .tag('m')
      ._finalize('r1');
    expect(def.middleware).toEqual([root]);
  });

  it('finalize() on the channel delegates to builder._finalize', () => {
    const ch = buildSimpleChannel();
    const b = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }))
      .body('hi')
      .tag('m');
    const def = ch.finalize(b, 'r2');
    expect(def.id).toBe('r2');
  });

  it('render invokes user render with runtime + args', async () => {
    const ch = buildSimpleChannel();
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ name: z.string() }))
      .body(({ input }) => `Hi ${(input as { name: string }).name}`)
      .tag('m')
      ._finalize('greet') as ChannelDefinition<TestArgs, TestRendered>;
    const out = await ch.render(def, { to: '+1', input: { name: 'A' } } as never, undefined);
    expect(out).toEqual({ body: 'Hi A', to: '+1' });
  });

  it('validateArgs (function) is wrapped as-is', async () => {
    const ch = buildSimpleChannel();
    const validated = await ch.validateArgs({ to: '+1', input: {} });
    expect(validated).toEqual({ to: '+1', input: {} });
    expect(() => ch.validateArgs({ input: {} })).toThrow(/to required/);
  });

  it('validateArgs accepts a Standard Schema and merges raw input back', async () => {
    const ch = defineChannel({
      name: 'schema-test' as const,
      slots: { body: slot.resolver<string>() },
      validateArgs: z.object({ to: z.string() }),
      render: ({ args }) => ({ body: 'x', to: (args as { to: string }).to }),
    });
    const validated = await ch.validateArgs({ to: '+1', input: { x: 1 } });
    expect(validated).toEqual({ to: '+1', input: { x: 1 } });
  });

  it('validateArgs schema rejects invalid args', async () => {
    const ch = defineChannel({
      name: 'schema-test' as const,
      slots: { body: slot.resolver<string>() },
      validateArgs: z.object({ to: z.string() }),
      render: ({ args }) => ({ body: 'x', to: (args as { to: string }).to }),
    });
    await expect(ch.validateArgs({ to: 123, input: {} })).rejects.toThrow();
  });

  it('validateArgs schema with non-object input gracefully handles missing input', async () => {
    const ch = defineChannel({
      name: 'schema-test' as const,
      slots: { body: slot.resolver<string>() },
      validateArgs: z.object({ to: z.string() }),
      render: ({ args }) => ({ body: 'x', to: (args as { to: string }).to }),
    });
    const validated = await ch.validateArgs({ to: '+1' });
    expect(validated).toMatchObject({ to: '+1' });
  });

  it('previewRender is wired when provided', async () => {
    const ch = defineChannel({
      name: 'pv' as const,
      slots: { body: slot.resolver<string>() },
      validateArgs: (args: unknown): TestArgs => args as TestArgs,
      render: ({ args }) => ({ body: 'x', to: (args as { to: string }).to }),
      previewRender: ({ runtime, input }) => {
        const body = typeof runtime.body === 'function' ? runtime.body({ input }) : runtime.body;
        return { body };
      },
    });
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ name: z.string() }))
      .body(({ input }) => `Hi ${(input as { name: string }).name}`)
      ._finalize('p1') as ChannelDefinition<TestArgs, TestRendered>;
    expect(ch.previewRender).toBeDefined();
    const out = await ch.previewRender!(def, { name: 'B' }, undefined);
    expect(out).toEqual({ body: 'Hi B' });
  });

  it('previewRender is undefined when not provided', () => {
    const ch = buildSimpleChannel();
    expect(ch.previewRender).toBeUndefined();
  });

  it('slot.resolver and slot.value tag with the right kind', () => {
    expect(slot.resolver<string>()).toMatchObject({ kind: 'resolver', required: true });
    expect(slot.value<number>()).toMatchObject({ kind: 'value', required: true });
  });

  it('slot.resolver().optional() marks the slot as optional', () => {
    expect(slot.resolver<string>().optional()).toMatchObject({ kind: 'resolver', required: false });
    expect(slot.value<number>().optional()).toMatchObject({ kind: 'value', required: false });
  });

  it('finalize succeeds without optional slots', () => {
    const ch = defineChannel({
      name: 'opt' as const,
      slots: {
        body: slot.resolver<string>(),
        extra: slot.resolver<string>().optional(),
      },
      validateArgs: (args: unknown): { input: unknown; to: string } =>
        args as { input: unknown; to: string },
      render: ({ runtime, args }) => ({
        body: typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body,
        to: args.to,
      }),
    });
    const def = ch
      .createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(z.object({ x: z.string() }))
      .body('hi')
      ._finalize('r1');
    expect(def.runtime).toEqual({ body: 'hi' });
  });
});
