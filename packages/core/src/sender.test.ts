import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSender } from './sender.js';
import { createEmailRpc } from './factory.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { TemplateAdapter } from './template.js';

describe('sender stubs', () => {
  it('createSender() throws EmailRpcNotImplementedError', () => {
    const adapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '' }),
    };
    const t = createEmailRpc();
    const catalog = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(adapter),
    });
    expect(() => createSender({ catalog, transport: {} })).toThrow(EmailRpcNotImplementedError);
  });
});
