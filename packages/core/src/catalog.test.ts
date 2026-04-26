import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { createEmailBuilder } from './builder.js';
import { createCatalog, isEmailCatalog, type InputOf, type OutputOf } from './catalog.js';
import { createEmailRpc } from './factory.js';
import type { TemplateAdapter } from './template.js';

const adapter = <T>(): TemplateAdapter<T> => ({
  render: async () => ({ html: '' }),
});

const buildEmail = (id: string) =>
  createEmailBuilder<unknown>({})
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Hi ${input.name}`)
    .template({ render: async () => ({ html: `<p>${id}</p>` }) });

describe('createCatalog (flat)', () => {
  it('produces a catalog branded as EmailCatalog', () => {
    const catalog = createCatalog({ welcome: buildEmail('welcome') });
    expect(isEmailCatalog(catalog)).toBe(true);
    expect(catalog._brand).toBe('EmailCatalog');
  });

  it('flattens single-level keys to dot-path-free ids', () => {
    const catalog = createCatalog({
      welcome: buildEmail('welcome'),
      reset: buildEmail('reset'),
    });
    expect(Object.keys(catalog.emails).sort()).toEqual(['reset', 'welcome']);
    expect(catalog.emails.welcome?.id).toBe('welcome');
    expect([...catalog.routes].sort()).toEqual(['reset', 'welcome']);
  });

  it('throws when an email procedure is incomplete', () => {
    const incomplete = createEmailBuilder<unknown>({}).input(z.object({}));
    expect(() => createCatalog({ x: incomplete as never })).toThrow(/incomplete/);
  });
});

describe('createCatalog (nested)', () => {
  it('flattens sub-catalogs into dot-path ids', () => {
    const transactional = createCatalog({
      welcome: buildEmail('welcome'),
      reset: buildEmail('reset'),
    });
    const marketing = createCatalog({ newsletter: buildEmail('newsletter') });
    const root = createCatalog({
      transactional,
      marketing,
      systemAlert: buildEmail('systemAlert'),
    });
    expect([...root.routes].sort()).toEqual([
      'marketing.newsletter',
      'systemAlert',
      'transactional.reset',
      'transactional.welcome',
    ]);
    expect(root.emails['transactional.welcome']?.id).toBe('transactional.welcome');
    expect(root.emails['marketing.newsletter']?.id).toBe('marketing.newsletter');
    expect(root.emails.systemAlert?.id).toBe('systemAlert');
  });

  it('preserves the nested view for proxy-based clients', () => {
    const transactional = createCatalog({ welcome: buildEmail('welcome') });
    const root = createCatalog({ transactional });
    expect(isEmailCatalog(root.nested.transactional)).toBe(true);
  });

  it('supports three-level nesting', () => {
    const inner = createCatalog({ leaf: buildEmail('leaf') });
    const mid = createCatalog({ inner });
    const root = createCatalog({ mid });
    expect(root.routes).toEqual(['mid.inner.leaf']);
    expect(root.emails['mid.inner.leaf']?.id).toBe('mid.inner.leaf');
  });

  it('allows empty catalogs', () => {
    const empty = createCatalog({});
    expect(empty.routes).toEqual([]);
  });
});

describe('createCatalog runtime extras', () => {
  const rpc = createEmailRpc();
  const welcome = rpc
    .email()
    .input(z.object({ name: z.string(), to: z.string().email() }))
    .subject(({ input }) => `Hi ${input.name}`)
    .template(adapter<{ name: string; to: string }>());

  const passwordReset = rpc
    .email()
    .input(z.object({ resetUrl: z.string().url(), to: z.string().email() }))
    .subject('Reset')
    .template(adapter<{ resetUrl: string; to: string }>());

  const catalog = rpc.catalog({ welcome, passwordReset });

  it('exposes the route ids', () => {
    expect(catalog.routes).toEqual(['welcome', 'passwordReset']);
  });

  it('preserves email definitions keyed by route id', () => {
    expect(catalog.emails.welcome?.id).toBe('welcome');
    expect(catalog.emails.passwordReset?.id).toBe('passwordReset');
  });

  it('throws at runtime when given an incomplete builder (defensive guard)', () => {
    const incomplete = rpc.email();
    expect(() => rpc.catalog({ incomplete } as never)).toThrow(/incomplete/);
  });

  it('defaults middleware to [] when builder state lacks the field', () => {
    const fake = {
      _state: {
        schema: z.object({ x: z.string() }),
        subject: 's',
        template: adapter<{ x: string }>(),
        from: undefined,
        replyTo: undefined,
        tags: {},
        priority: 'normal',
      },
    };
    const c = rpc.catalog({ fake } as never) as unknown as {
      emails: Record<string, { middleware: unknown[] }>;
    };
    expect(c.emails.fake?.middleware).toEqual([]);
  });
});

describe('createCatalog type-level guarantees', () => {
  const rpc = createEmailRpc();

  it('rejects catalogs that include an incomplete builder', () => {
    const complete = rpc
      .email()
      .input(z.object({ x: z.string() }))
      .subject('s')
      .template(adapter<{ x: string }>());
    const missingTemplate = rpc
      .email()
      .input(z.object({ y: z.string() }))
      .subject('s');

    expect(() => {
      // @ts-expect-error — missingTemplate has no template, should fail
      rpc.catalog({ complete, missingTemplate });
    }).toThrow(/incomplete/);
  });

  it('rejects catalogs that include a builder with no input', () => {
    const noInput = rpc.email();
    expect(() => {
      // @ts-expect-error — noInput is missing input, subject, template
      rpc.catalog({ noInput });
    }).toThrow(/incomplete/);
  });

  it('exposes input/output type helpers on the catalog', () => {
    const a = rpc
      .email()
      .input(z.object({ name: z.string(), age: z.number().default(0) }))
      .subject('s')
      .template(adapter<{ name: string; age: number }>());
    const c = rpc.catalog({ a });

    expectTypeOf<InputOf<typeof c, 'a'>>().toEqualTypeOf<{
      name: string;
      age?: number;
    }>();
    expectTypeOf<OutputOf<typeof c, 'a'>>().toEqualTypeOf<{
      name: string;
      age: number;
    }>();
  });
});
