import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel, createTransport, multiTransport } from '@betternotify/email';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel();
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

// Each provider closes over its own verified sender — no framework defaultFrom.
const stubProvider = (label: string, accountFrom: { name: string; email: string }) =>
  createTransport({
    name: label,
    send: async (msg) => {
      const from = msg.from ?? accountFrom;
      console.log(`[${label}] from=${JSON.stringify(from)} to=${msg.to.join(',')}`);
      return { ok: true, data: { accepted: msg.to.map(String), rejected: [] } };
    },
  });

export const runMultiRoundRobin = async (): Promise<void> => {
  const composite = multiTransport({
    name: 'round-robin',
    strategy: 'round-robin',
    transports: [
      {
        transport: stubProvider('mock-a', { name: 'Account A', email: 'noreply@a.example.com' }),
      },
      {
        transport: stubProvider('mock-b', { name: 'Account B', email: 'noreply@b.example.com' }),
      },
    ],
    logger: consoleLogger({ level: 'debug' }),
  });

  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: composite },
    logger: consoleLogger({ level: 'info' }),
  });

  console.log('Two providers alternating round-robin; each stamps its account-bound `from`.');
  console.log('---');
  for (let i = 1; i <= 4; i++) {
    const result = await mail.welcome.send({
      to: env.SMTP_DESTINATION_EMAIL,
      input: { name: `User ${i}`, verifyUrl: `https://example.com/verify?token=abc${i}` },
    });
    console.log(
      `Send #${i}: id=${result.messageId.slice(0, 8)} (see [provider] log above for from)`,
    );
  }
};
