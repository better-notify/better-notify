import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { createTransport, multiTransport } from '@betternotify/email/transports';
import { smtpTransport } from '@betternotify/smtp';
import { z } from 'zod';
import { env } from '../env';
import { mockFailSend } from '../test-utils';

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
        // smtp falls back to auth.user when message.from is unset
        transport: smtpTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        }),
      },
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
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('Message ID:', result.messageId);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
