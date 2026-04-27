import { createNotify, createClient, withDryRun } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { z } from 'zod';
import { mockTransport } from '../test-utils';

export const runDryRun = async (): Promise<void> => {
  const ch = emailChannel({ defaults: { from: 'demo@example.com' } });
  const rpc = createNotify({ channels: { email: ch } }).use(withDryRun());
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
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
  });

  const result = await mail.welcome.send({
    to: 'john@example.com',
    input: { name: 'John Doe' },
  });

  console.log('messageId:', result.messageId);
  console.log('— withDryRun short-circuited; render and transport never ran.');
};
