import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorker } from './worker.js';
import { createEmailRpc } from './factory.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { TemplateAdapter } from './template.js';
import type { Transport } from './transports/types.js';
import type { QueueAdapter } from './queue.js';

describe('worker stubs', () => {
  it('createWorker() throws EmailRpcNotImplementedError', () => {
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
    const transport = {} as Transport;
    const queue = {} as QueueAdapter;
    expect(() => createWorker({ catalog, transport, queue })).toThrow(EmailRpcNotImplementedError);
  });
});
