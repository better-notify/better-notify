import { createNotify, createClient, consoleLogger } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
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

export const runBatch = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    logger: consoleLogger({ level: 'info' }),
  });

  const recipients: { name: string; email: string; verifyUrl: string }[] = [
    { name: 'Alice', email: 'alice@example.com', verifyUrl: 'https://example.com/verify/alice' },
    { name: 'Bob', email: 'bob@example.com', verifyUrl: 'https://example.com/verify/bob' },
    { name: 'Carol', email: 'carol@example.com', verifyUrl: 'not-a-url' },
    { name: 'Dave', email: 'dave@example.com', verifyUrl: 'https://example.com/verify/dave' },
    { name: 'Eve', email: 'eve@example.com', verifyUrl: 'https://example.com/verify/eve' },
  ];

  const startedAt = performance.now();

  const batchResult = await mail.welcome.batch(
    recipients.map((r) => ({
      to: r.email,
      input: { name: r.name, verifyUrl: r.verifyUrl },
    })),
    { interval: 250 },
  );

  const totalMs = performance.now() - startedAt;

  console.log(`Total wall time: ${totalMs.toFixed(0)}ms`);
  console.log(`Sent OK:         ${batchResult.okCount}`);
  console.log(`Errors:          ${batchResult.errorCount}`);
  console.log('---');

  for (const entry of batchResult.results) {
    const recipient = recipients[entry.index];
    if (entry.status === 'ok') {
      console.log(`  [${entry.index}] ok    → ${recipient?.email} (${entry.result.messageId})`);
    } else {
      console.log(
        `  [${entry.index}] error → ${recipient?.email} (${entry.error.code}: ${entry.error.message})`,
      );
    }
  }
};
