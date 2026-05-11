import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { onesignalEmailTransport } from '@betternotify/onesignal';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.ONESIGNAL_FROM_EMAIL } },
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

export const runEmailOnesignal = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: onesignalEmailTransport<typeof catalog>({
        appId: env.ONESIGNAL_APP_ID,
        apiKey: env.ONESIGNAL_API_KEY,
        body: { template_id: 'default-template' },
        bodyFor: {
          welcome: { template_id: 'welcome-template' },
        },
      }),
    },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.ONESIGNAL_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
    transport: {
      onesignal: {
        send_after: '2026-05-11T12:00:00Z',
      },
    },
  });

  console.log('Message ID:', result.messageId);
  console.log('From:      ', result.envelope?.from);
  console.log('To:        ', result.envelope?.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
