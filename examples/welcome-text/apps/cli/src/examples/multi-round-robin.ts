import { createNotify, createClient, consoleLogger } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { multiTransport } from '@emailrpc/email/transports';
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

export const runMultiRoundRobin = async (): Promise<void> => {
  const composite = multiTransport({
    name: 'round-robin',
    strategy: 'round-robin',
    transports: [
      { transport: mockTransport('mock-a') },
      { transport: mockTransport('mock-b') },
    ],
    logger: consoleLogger({ level: 'debug' }),
  });

  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: composite },
    logger: consoleLogger({ level: 'debug' }),
  });

  for (let i = 1; i <= 4; i++) {
    const result = await mail.welcome.send({
      to: env.SMTP_DESTINATION_EMAIL,
      input: { name: `User ${i}`, verifyUrl: `https://example.com/verify?token=abc${i}` },
    });
    console.log(`Send #${i}:`, result.messageId, '→', result.envelope?.to.join(', '));
  }
};
