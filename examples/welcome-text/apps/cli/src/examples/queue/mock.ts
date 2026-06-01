import {
  createNotify,
  createClient,
  consoleLogger,
  NotifyRpcProviderError,
} from '@betternotify/core';
import { createMockQueue, createQueueWorker, type JobResult } from '@betternotify/core/queue';
import { emailChannel } from '@betternotify/email';
import { createTransport, type Transport } from '@betternotify/email/transports';
import { z } from 'zod';
import { env } from '../../env';

const RETRY_RECIPIENT = 'retry@example.com';

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

const flakyTransport: Transport = createTransport({
  name: 'flaky',
  send: async (message) => {
    const recipients = message.to.map((a) => (typeof a === 'string' ? a : a.email));
    if (recipients.includes(RETRY_RECIPIENT)) {
      throw new NotifyRpcProviderError({
        provider: 'flaky',
        message: 'simulated transient provider failure',
        retriable: true,
      });
    }
    return { ok: true, data: { accepted: recipients, rejected: [] } };
  },
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const runQueue = async (): Promise<void> => {
  const queue = createMockQueue();
  const transportsByChannel = { email: flakyTransport };

  const mail = createClient({
    catalog,
    transportsByChannel,
    queue: queue.producer,
    logger: consoleLogger({ level: 'warn' }),
  });

  console.log('Enqueueing jobs...');

  const ada = await mail.welcome.queue({
    to: 'ada@example.com',
    input: { name: 'Ada', verifyUrl: 'https://example.com/verify/ada' },
  });
  console.log(`  queued   → ada@example.com (${ada.id})`);

  const flaky = await mail.welcome.queue({
    to: RETRY_RECIPIENT,
    input: { name: 'Mallory', verifyUrl: 'https://example.com/verify/mallory' },
  });
  console.log(`  queued   → ${RETRY_RECIPIENT} (${flaky.id}) — transport will fail retriably`);

  const batch = await mail.welcome.queueBatch([
    { to: 'bob@example.com', input: { name: 'Bob', verifyUrl: 'https://example.com/verify/bob' } },
    { to: 'carol@example.com', input: { name: 'Carol', verifyUrl: 'not-a-url' } },
    {
      to: 'dave@example.com',
      input: { name: 'Dave', verifyUrl: 'https://example.com/verify/dave' },
    },
  ]);
  console.log(
    `  batch    → enqueued ${batch.okCount}, rejected ${batch.errorCount} (eager validation)`,
  );
  for (const entry of batch.results) {
    if (entry.status === 'error') {
      console.log(`    [${entry.index}] rejected (${entry.error.code}: ${entry.error.message})`);
    }
  }

  console.log('---');
  console.log(`Pending jobs: ${queue.pending.length}`);
  console.log('---');

  const completed: JobResult[] = [];
  const deadLettered: JobResult[] = [];
  const expectedTerminal = 4;

  const worker = createQueueWorker({
    catalog,
    transportsByChannel,
    consumer: queue.consumer,
    concurrency: 4,
    maxAttempts: 3,
    idleDelayMs: 10,
    logger: consoleLogger({ level: 'warn' }),
  });

  worker.on('completed', (result) => {
    completed.push(result);
  });
  worker.on('failed', (result) => {
    if (result.status === 'dlq') deadLettered.push(result);
  });

  const running = worker.start();

  while (completed.length + deadLettered.length < expectedTerminal) {
    await sleep(20);
  }

  await worker.close();
  await running;

  console.log('Worker drained.');
  console.log(`  completed (sent): ${completed.length}`);
  for (const result of completed) {
    if (result.status === 'sent') console.log(`    sent → ${result.messageId}`);
  }
  console.log(`  dead-lettered:    ${queue.dlq.length}`);
  for (const dead of queue.dlq) {
    if (dead.result.status === 'dlq') {
      console.log(
        `    dlq  → ${dead.job.envelope.id} (reason: ${dead.result.reason}, attempts: ${dead.job.envelope.attempt + 1})`,
      );
    }
  }
};
