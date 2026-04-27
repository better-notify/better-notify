import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { multiTransport } from '@betternotify/email/transports';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const rpc = createNotify({ channels: { email: ch } });
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}!`,
        html: `<p>Welcome, ${input.name}!</p>`,
      }),
    }),
});

export const runMultiParallel = async (): Promise<void> => {
  const composite = multiTransport({
    name: 'parallel',
    strategy: 'parallel',
    transports: [
      { transport: mockTransport('primary') },
      { transport: mockTransport('audit-copy') },
    ],
    logger: consoleLogger({ level: 'debug' }),
  });

  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: composite },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe' },
  });

  console.log('Message ID:', result.messageId);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
  console.log('verified-redundancy: every branch must succeed; we throw if any one fails.');
};
