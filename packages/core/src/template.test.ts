import { describe, expect, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { emailRpc } from './index.js';
import type { TemplateAdapter } from './template.js';

describe('TemplateAdapter', () => {
  it('attaches when its TInput matches the schema output', () => {
    const t = emailRpc.init();
    const schema = z.object({ name: z.string(), url: z.string().url() });
    const adapter: TemplateAdapter<{ name: string; url: string }> = {
      render: async ({ name, url }) => ({ html: `<a href="${url}">Hi ${name}</a>` }),
    };

    const def = t.email().input(schema).subject('Hi').template(adapter);

    expect(def._state.template).toBe(adapter);
  });

  it('refuses adapters whose TInput is wider than the schema output', () => {
    const t = emailRpc.init();
    const schema = z.object({ name: z.string() });
    const adapter: TemplateAdapter<{ name: string; required: number }> = {
      render: async () => ({ html: '' }),
    };

    // @ts-expect-error — adapter requires `required: number`, schema doesn't provide it
    t.email().input(schema).subject('s').template(adapter);
  });

  it('infers TInput from the schema for inline adapters', async () => {
    const t = emailRpc.init();
    const schema = z.object({ name: z.string(), url: z.string() });

    const def = t
      .email()
      .input(schema)
      .subject('Hi')
      .template({
        render: async (input) => {
          expectTypeOf(input).toEqualTypeOf<{ name: string; url: string }>();
          return { html: `<a href="${input.url}">Hi ${input.name}</a>` };
        },
      });

    const rendered = await def._state.template!.render({ name: 'Lucas', url: 'https://x.com' });
    expect(rendered.html).toContain('Lucas');
  });
});
