import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSender } from './sender.js';
import { emailRpc } from './init.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { TemplateAdapter } from './template.js';

describe('sender stubs', () => {
  it('createSender() throws EmailRpcNotImplementedError', () => {
    const adapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '' }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(adapter),
    });
    expect(() => createSender({ router, provider: {} })).toThrow(EmailRpcNotImplementedError);
  });
});
