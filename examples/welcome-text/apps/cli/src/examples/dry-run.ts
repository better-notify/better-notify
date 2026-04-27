import { createClient, createEmailRpc, withDryRun } from '@emailrpc/core';
import { z } from 'zod';
import { mockTransport } from '../test-utils';

export const runDryRun = async (): Promise<void> => {
  const rpc = createEmailRpc().use(withDryRun());
  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template({
        render: async ({ input }) => ({ html: `<p>Hello ${input.name}</p>` }),
      }),
  });

  const mail = createClient({
    catalog,
    transports: [{ name: 'mock', priority: 1, transport: mockTransport('mock') }],
    defaults: { from: 'demo@example.com' },
  });

  const result = await mail.welcome.send({
    to: 'john@example.com',
    input: { name: 'John Doe' },
  });

  console.log('messageId:', result.messageId);
  console.log('— withDryRun short-circuited; render and transport never ran.');
};
