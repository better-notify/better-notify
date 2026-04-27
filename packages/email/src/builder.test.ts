import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { createEmailRpc } from '@emailrpc/core';
import type { Middleware } from '@emailrpc/core';
import type { TemplateAdapter } from './template.js';

const stubAdapter: TemplateAdapter<{
  name: string;
  verifyUrl: string;
  locale: 'en' | 'pt-BR';
}> = {
  render: async () => ({ html: '<p>hi</p>' }),
};

describe('EmailBuilder runtime', () => {
  it('stores schema, subject, template, and metadata', () => {
    const t = createEmailRpc();
    const schema = z.object({
      name: z.string(),
      verifyUrl: z.string().url(),
      locale: z.enum(['en', 'pt-BR']).default('en'),
    });
    const def = t
      .email()
      .input(schema)
      .from('hello@example.com')
      .replyTo('support@example.com')
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter)
      .tags({ category: 'transactional' })
      .priority('high');

    expect(def._state.schema).toBe(schema);
    expect(def._state.template).toBe(stubAdapter);
    expect(def._state.from).toBe('hello@example.com');
    expect(def._state.replyTo).toBe('support@example.com');
    expect(def._state.tags).toEqual({ category: 'transactional' });
    expect(def._state.priority).toBe('high');
    expect(typeof def._state.subject).toBe('function');
  });

  it('builder methods are immutable — each call returns a fresh builder', () => {
    const t = createEmailRpc();
    const a = t.email();
    const b = a.input(z.object({ name: z.string() }));
    expect(a).not.toBe(b);
    expect(a._state.schema).toBeUndefined();
    expect(b._state.schema).toBeDefined();
  });
});

describe('EmailBuilder type-level guarantees', () => {
  it('rejects calling .input() twice', () => {
    const t = createEmailRpc();
    const b = t.email().input(z.object({ name: z.string() }));
    // @ts-expect-error — input slot already filled
    b.input(z.object({ other: z.string() }));
  });

  it('rejects .template() before .input()', () => {
    const t = createEmailRpc();
    const adapter: TemplateAdapter<unknown> = {
      render: async () => ({ html: '' }),
    };
    // @ts-expect-error — must call .input() first
    t.email().template(adapter);
  });

  it('rejects calling .subject() twice', () => {
    const t = createEmailRpc();
    const b = t
      .email()
      .input(z.object({ n: z.string() }))
      .subject('hi');
    // @ts-expect-error — subject slot already filled
    b.subject('hi again');
  });

  it('infers subject input type from schema output', () => {
    const t = createEmailRpc();
    t.email()
      .input(z.object({ name: z.string(), age: z.number() }))
      .subject(({ input }) => {
        expectTypeOf(input).toEqualTypeOf<{ name: string; age: number }>();
        return `Hi ${input.name}, ${input.age}`;
      });
  });

  it('infers template adapter input type from schema output', () => {
    const t = createEmailRpc();
    t.email()
      .input(z.object({ name: z.string() }))
      .subject('s')
      .template({
        render: async ({ input }) => {
          expectTypeOf(input).toEqualTypeOf<{ name: string }>();
          return { html: `<p>${input.name}</p>` };
        },
      });
  });
});

describe('EmailBuilder.use()', () => {
  it('returns a new builder, not the same instance', () => {
    const t = createEmailRpc();
    const mw: Middleware = async ({ next }) => next();
    const b1 = t.email();
    const b2 = b1.use(mw);
    expect(b2).not.toBe(b1);
  });

  it('appends middleware to the builder state', () => {
    const t = createEmailRpc();
    const mw1: Middleware = async ({ next }) => next();
    const mw2: Middleware = async ({ next }) => next();
    const b = t.email().use(mw1).use(mw2);
    const state = (b as unknown as { _state: { middleware: unknown[] } })._state;
    expect(state.middleware).toEqual([mw1, mw2]);
  });

  it('propagates middleware through subsequent slot calls', () => {
    const t = createEmailRpc();
    const mw: Middleware = async ({ next }) => next();
    const b = t
      .use(mw)
      .email()
      .input(z.object({ x: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) });
    const state = (b as unknown as { _state: { middleware: unknown[] } })._state;
    expect(state.middleware).toEqual([mw]);
  });

  it('makes middleware reach EmailDefinition via the router', () => {
    const t = createEmailRpc();
    const mw: Middleware = async ({ next }) => next();
    const welcome = t
      .use(mw)
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) });
    const router = t.catalog({ welcome });
    expect(router.emails.welcome.middleware).toEqual([mw]);
  });

  it('_finalize throws when builder is incomplete', () => {
    const incomplete = createEmailRpc()
      .email()
      .input(z.object({ name: z.string() })) as unknown as {
      _finalize: (id: string) => unknown;
    };
    expect(() => incomplete._finalize('x')).toThrow(/incomplete/);
  });

  it('.template(fn) accepts a render function and normalizes it to an adapter', async () => {
    const t = createEmailRpc();
    const built = t
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template(({ input }) => ({ html: `<p>${input.name}</p>`, text: `Hi ${input.name}` }));
    const router = t.catalog({ welcome: built });
    const out = await router.emails.welcome.template.render({
      input: { name: 'Lucas' },
      ctx: undefined,
    });
    expect(out.html).toBe('<p>Lucas</p>');
    expect(out.text).toBe('Hi Lucas');
  });
});
