import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { selligentTransport } from '@betternotify/selligent';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.SELLIGENT_FROM_EMAIL } },
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

export const runEmailSelligent = async (): Promise<void> => {
  const transport = selligentTransport({
    clientId: Number(env.SELLIGENT_CLIENT_ID),
    clientSecret: env.SELLIGENT_CLIENT_SECRET,
    accountId: env.SELLIGENT_ACCOUNT_ID,
  });

  if (transport.verify) {
    const verifyResult = await transport.verify();
    console.log('Verify:', verifyResult.ok ? 'OK' : `FAILED — ${verifyResult.details}`);
  }

  const mail = createClient({
    catalog,
    transportsByChannel: { email: transport },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.welcome.send({
    to: env.SELLIGENT_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('Message ID:', result.messageId);
  console.log('From:      ', result.envelope?.from);
  console.log('To:        ', result.envelope?.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
