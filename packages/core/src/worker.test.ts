import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorker } from './worker.js';
import { emailRpc } from './init.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { TemplateAdapter } from './template.js';
import type { Provider } from './provider.js';
import type { QueueAdapter } from './queue.js';

describe('worker stubs', () => {
  it('createWorker() throws EmailRpcNotImplementedError', () => {
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
    const provider = {} as Provider;
    const queue = {} as QueueAdapter;
    expect(() => createWorker({ router, provider, queue })).toThrow(EmailRpcNotImplementedError);
  });
});
