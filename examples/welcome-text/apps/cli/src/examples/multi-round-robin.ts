import {
  createClient,
  consoleLogger,
  createEmailRpc,
  type TransportEntry,
} from '@emailrpc/core';
import { multiTransport } from '@emailrpc/core/transports';
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

  const transports: TransportEntry[] = [
    { name: 'round-robin', priority: 1, transport: composite },
  ];

  const mail = createClient({
    catalog,
    transports,
    logger: consoleLogger({ level: 'debug' }),
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
  });

  for (let i = 1; i <= 4; i++) {
    const result = await mail.welcome.send({
      to: env.SMTP_DESTINATION_EMAIL,
      input: { name: `User ${i}`, verifyUrl: `https://example.com/verify?token=abc${i}` },
    });
    console.log(`Send #${i}:`, result.messageId, '→', result.envelope.to.join(', '));
  }
};
