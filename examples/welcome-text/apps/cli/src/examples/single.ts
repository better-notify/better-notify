import { createClient, consoleLogger, createEmailRpc } from '@emailrpc/core';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const rpc = createEmailRpc();
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
    transports: [{ name: 'mock', priority: 1, transport: mockTransport('mock') }],
    logger: consoleLogger({ level: 'debug' }),
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('Message ID:', result.messageId);
  console.log('Accepted:  ', result.accepted.join(', '));
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
