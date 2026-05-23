import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { unosendTransport } from '@betternotify/unosend';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.UNOSEND_FROM_EMAIL } },
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
      }),
    }),
});

export const runEmailUnosendTemplate = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    transportsByChannel: {
      email: unosendTransport({
        apiKey: env.UNOSEND_API_KEY,
      }),
    },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.UNOSEND_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
    transport: {
      unosend: {
        template_id: 'tmpl_welcome_001',
        template_data: {
          name: 'John Doe',
          verify_url: 'https://example.com/verify?token=abc123',
          company: 'Better-Notify',
        },
      },
    },
  });

  console.log('Message ID:', result.messageId);
  console.log('From:      ', result.envelope?.from);
  console.log('To:        ', result.envelope?.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
