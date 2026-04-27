import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { createCatalog, isCatalog, type InputOf, type OutputOf } from './catalog.js';
import type { ChannelDefinition } from './channel/types.js';

const buildFakeChannelBuilder = (channel: string, schema: z.ZodTypeAny = z.object({ name: z.string() })) => ({
  _channel: channel,
  _finalize: (id: string): ChannelDefinition<unknown, unknown> => ({
    id,
    channel,
    schema,
    middleware: [],
    runtime: { body: 'hi' },
    _args: undefined as never,
    _rendered: undefined as never,
  }),
});

describe('createCatalog (flat)', () => {
  it('produces a catalog branded as Catalog', () => {
    const catalog = createCatalog({ welcome: buildFakeChannelBuilder('email') as never });
    expect(isCatalog(catalog)).toBe(true);
    expect(catalog._brand).toBe('Catalog');
  });

  it('flattens single-level keys to dot-path-free ids', () => {
    const catalog = createCatalog({
      welcome: buildFakeChannelBuilder('email') as never,
      reset: buildFakeChannelBuilder('email') as never,
    });
    expect(Object.keys(catalog.definitions).sort()).toEqual(['reset', 'welcome']);
    expect(catalog.definitions.welcome?.id).toBe('welcome');
    expect([...catalog.routes].sort()).toEqual(['reset', 'welcome']);
  });

  it('throws when a value is not a channel route or sub-catalog', () => {
    expect(() => createCatalog({ x: { junk: true } as never })).toThrow(/not a channel route/);
  });
});

describe('createCatalog (nested)', () => {
  it('flattens sub-catalogs into dot-path ids', () => {
    const transactional = createCatalog({
      welcome: buildFakeChannelBuilder('email') as never,
      reset: buildFakeChannelBuilder('email') as never,
    });
    const marketing = createCatalog({ newsletter: buildFakeChannelBuilder('email') as never });
    const root = createCatalog({
      transactional,
      marketing,
      systemAlert: buildFakeChannelBuilder('email') as never,
    });
    expect([...root.routes].sort()).toEqual([
      'marketing.newsletter',
      'systemAlert',
      'transactional.reset',
      'transactional.welcome',
    ]);
    expect(root.definitions['transactional.welcome']?.id).toBe('transactional.welcome');
    expect(root.definitions['marketing.newsletter']?.id).toBe('marketing.newsletter');
    expect(root.definitions.systemAlert?.id).toBe('systemAlert');
  });

  it('preserves the nested view for proxy-based clients', () => {
    const transactional = createCatalog({ welcome: buildFakeChannelBuilder('email') as never });
    const root = createCatalog({ transactional });
    expect(isCatalog(root.nested.transactional)).toBe(true);
  });

  it('supports three-level nesting', () => {
    const inner = createCatalog({ leaf: buildFakeChannelBuilder('email') as never });
    const mid = createCatalog({ inner });
    const root = createCatalog({ mid });
    expect(root.routes).toEqual(['mid.inner.leaf']);
    expect(root.definitions['mid.inner.leaf']?.id).toBe('mid.inner.leaf');
  });

  it('allows empty catalogs', () => {
    const empty = createCatalog({});
    expect(empty.routes).toEqual([]);
  });
});

describe('createCatalog (mixed channels)', () => {
  it('finalizes builders from multiple channels into definitions', () => {
    const catalog = createCatalog({
      greet: buildFakeChannelBuilder('sms') as never,
      ping: buildFakeChannelBuilder('push') as never,
      welcome: buildFakeChannelBuilder('email') as never,
    });
    expect(catalog.definitions.greet?.channel).toBe('sms');
    expect(catalog.definitions.ping?.channel).toBe('push');
    expect(catalog.definitions.welcome?.channel).toBe('email');
    expect([...catalog.routes].sort()).toEqual(['greet', 'ping', 'welcome']);
  });
});

describe('createCatalog type-level guarantees', () => {
  it('exposes input/output type helpers on the catalog', () => {
    const builder = {
      _channel: 'sms' as const,
      schema: z.object({ name: z.string(), age: z.number().default(0) }),
      _finalize: (id: string): ChannelDefinition<unknown, unknown> => ({
        id,
        channel: 'sms',
        schema: z.object({ name: z.string(), age: z.number().default(0) }),
        middleware: [],
        runtime: {},
        _args: undefined as never,
        _rendered: undefined as never,
      }),
    };
    const c = createCatalog({ a: builder as never });
    expectTypeOf<InputOf<typeof c, 'a'>>().toEqualTypeOf<unknown>();
    expectTypeOf<OutputOf<typeof c, 'a'>>().toEqualTypeOf<unknown>();
  });
});
