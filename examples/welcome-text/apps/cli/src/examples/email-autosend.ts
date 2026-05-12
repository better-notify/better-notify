import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { autosendTransport } from '@betternotify/autosend';
import { z } from 'zod';
import { env } from '../env';
import { reactEmail } from '@betternotify/react-email';
import { Welcome } from '../templates/welcome';

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.AUTOSEND_FROM_EMAIL } },
});

const rpc = createNotify({ channels: { email: ch } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(({ input }) => reactEmail(Welcome, { name: input.name, verifyUrl: input.verifyUrl })),
});

export const runEmailAutosend = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    transportsByChannel: {
      email: autosendTransport({
        apiKey: env.AUTOSEND_API_KEY,
      }),
    },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.AUTOSEND_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('Message ID:', result.messageId);
  console.log('From:      ', result.envelope?.from);
  console.log('To:        ', result.envelope?.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
