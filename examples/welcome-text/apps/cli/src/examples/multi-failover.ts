import {
  createClient,
  consoleLogger,
  createTransport,
  createEmailRpc,
  type TransportEntry,
} from '@emailrpc/core';
import { multiTransport } from '@emailrpc/core/transports';
import { smtpTransport } from '@emailrpc/smtp';
import { z } from 'zod';
import { env } from '../env';
import { mockFailSend } from '../test-utils';

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

export const runMultiFailover = async (): Promise<void> => {
  const composite = multiTransport({
    name: 'failover',
    strategy: 'failover',
    transports: [
      {
        transport: createTransport({
          name: 'broken-primary',
          send: mockFailSend(new Error('simulated primary outage')),
        }),
      },
      {
        transport: smtpTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        }),
      },
    ],
    logger: consoleLogger({ level: 'debug' }),
  });

  const transports: TransportEntry[] = [
    { name: 'failover', priority: 1, transport: composite },
  ];

  const mail = createClient({
    catalog,
    transports,
    logger: consoleLogger({ level: 'debug' }),
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('Message ID:', result.messageId);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
