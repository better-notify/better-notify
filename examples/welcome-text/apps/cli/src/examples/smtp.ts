import {
  createClient,
  consoleLogger,
  createEmailRpc,
  type TransportEntry,
} from '@emailrpc/core';
import { smtpTransport } from '@emailrpc/smtp';
import { z } from 'zod';
import { env } from '../env';

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

export const runSmtp = async (): Promise<void> => {
  const transports: TransportEntry[] = [
    {
      name: 'smtp',
      priority: 1,
      transport: smtpTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      }),
    },
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
  console.log('From:      ', result.envelope.from);
  console.log('To:        ', result.envelope.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
