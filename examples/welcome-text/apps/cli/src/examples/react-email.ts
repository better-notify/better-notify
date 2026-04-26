import { createClient, consoleLogger, createEmailRpc } from '@emailrpc/core';
import { reactEmail } from '@emailrpc/react-email';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';
import { Welcome } from '../templates/welcome';

const rpc = createEmailRpc();
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
    transports: [{ name: 'mock', priority: 1, transport: mockTransport('mock') }],
    logger: consoleLogger({ level: 'info' }),
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: {
      name: 'Lucas',
      verifyUrl: 'https://example.com/verify?token=abc123',
    },
  });

  console.log('messageId:', result.messageId);
  console.log('subject :', `Welcome, ${result.envelope.to[0]}`);
  console.log('— rendered through @emailrpc/react-email; HTML body sent to transport.');
};
