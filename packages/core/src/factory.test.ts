import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createEmailRpc } from './factory.js';
import { isCatalog } from './catalog.js';

describe('createEmailRpc', () => {
  it('returns a root builder with email/use/catalog methods', () => {
    const rpc = createEmailRpc<{ tenantId: string }>();
    expect(typeof rpc.email).toBe('function');
    expect(typeof rpc.use).toBe('function');
    expect(typeof rpc.catalog).toBe('function');
  });

  it('produces a catalog from a single email procedure', () => {
    const rpc = createEmailRpc();
    const welcome = rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Hi ${input.name}`)
      .template({ render: async () => ({ html: '<p>hi</p>' }) });
    const catalog = rpc.catalog({ welcome });
    expect(isCatalog(catalog)).toBe(true);
    expect(catalog.routes).toEqual(['welcome']);
  });

  it('chains root middleware via .use', () => {
    const rpc = createEmailRpc<{ a: string }>().use<{ a: string; b: number }>(
      async ({ ctx, next }) => next({ ...ctx, b: 1 }),
    );
    const welcome = rpc
      .email()
      .input(z.object({}))
      .subject('hi')
      .template({ render: async () => ({ html: '' }) });
    const catalog = rpc.catalog({ welcome });
    expect(catalog.routes).toEqual(['welcome']);
  });
});
