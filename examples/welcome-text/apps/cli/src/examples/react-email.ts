import { createNotify, createClient, consoleLogger } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { reactEmail } from '@emailrpc/react-email';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';
import { Welcome } from '../templates/welcome';

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const rpc = createNotify({ channels: { email: ch } });
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(({ input }) => reactEmail(Welcome, input)),
});

export const runReactEmail = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    logger: consoleLogger({ level: 'info' }),
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: {
      name: 'John Doe',
      verifyUrl: 'https://example.com/verify?token=abc123',
    },
  });

  console.log('messageId:', result.messageId);
  console.log('to       :', result.envelope?.to.join(', '));
  console.log('— rendered through @emailrpc/react-email; HTML body sent to transport.');
};
