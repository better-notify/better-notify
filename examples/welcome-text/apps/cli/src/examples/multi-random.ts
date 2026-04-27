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

// Each transport closes over its own account-bound sender.
const stub = (label: string, accountFrom: string) =>
  createTransport({
    name: label,
    send: async (msg) => {
      const from = msg.from ?? accountFrom;
      console.log(`[${label}] from=${JSON.stringify(from)} to=${msg.to.join(',')}`);
      return { ok: true, data: { accepted: msg.to.map(String), rejected: [] } };
    },
  });

export const runMultiRandom = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: multiTransport({
        name: 'random',
        strategy: 'random',
        transports: [
          { transport: stub('transport-1', 'a@example.com') },
          { transport: stub('transport-2', 'b@example.com') },
          { transport: stub('transport-3', 'c@example.com') },
        ],
        logger: consoleLogger({ level: 'info' }),
      }),
    },
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('---');
  console.log('Message ID:', result.messageId);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
  console.log('(actual sender printed by selected provider above)');
};
