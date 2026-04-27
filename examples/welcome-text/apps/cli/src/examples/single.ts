import { createNotify, createClient, consoleLogger } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
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
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}! Verify here: ${input.verifyUrl}`,
        html: `<p>Welcome, ${input.name}! <a href="${input.verifyUrl}">Verify</a></p>`,
      }),
    }),
});

export const runSingle = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  const data = result.data as { accepted: string[] };
  console.log('Message ID:', result.messageId);
  console.log('Accepted:  ', data.accepted.join(', '));
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
