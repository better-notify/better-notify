import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import {
  createJobProcessor,
  createQueueProducer,
  type JobEnvelope,
} from '@betternotify/core/queue';
import { emailChannel } from '@betternotify/email';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { z } from 'zod';
import { env } from '../../env';
import { mockTransport } from '../../test-utils';

export type BullmqEnqueueData = Pick<JobsOptions, 'delay' | 'attempts' | 'backoff'>;

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface QueueDataMap {
    bullmq: BullmqEnqueueData;
  }
}

const QUEUE_NAME = 'tx-emails';

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

const transportsByChannel = { email: mockTransport('mock') };

export const makeBullmqProducer = (queue: Queue) =>
  createQueueProducer({
    enqueue: async (envelope, opts) => {
      await queue.add(envelope.route, envelope, opts?.bullmq);
      return { id: envelope.id };
    },
    enqueueBatch: async (envelopes, opts) => {
      await queue.addBulk(
        envelopes.map((envelope) => ({ name: envelope.route, data: envelope, opts: opts?.bullmq })),
      );
      return envelopes.map((envelope) => ({ id: envelope.id }));
    },
  });

export const runQueueBullmq = async (): Promise<void> => {
  const redisUrl = env.REDIS_URL;

  if (!redisUrl) {
    console.log('REDIS_URL not set — skipping live BullMQ run (typed reference only).');
    return;
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });

  const mail = createClient({
    catalog,
    transportsByChannel,
    queue: makeBullmqProducer(queue),
    logger: consoleLogger({ level: 'info' }),
  });

  const processor = createJobProcessor({ catalog, transportsByChannel });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const result = await processor.process(job.data as JobEnvelope);
      if (result.status === 'retry') throw new Error(result.error.message);
      if (result.status === 'dlq') {
        console.warn(`dlq: ${job.id} (${result.reason}: ${result.error.message})`);
      }
    },
    { connection },
  );

  worker.on('completed', (job) => console.log(`sent → ${job.id}`));
  worker.on('failed', (job, err) => console.warn(`failed → ${job?.id} (${err.message})`));

  await mail.welcome.queue(
    { to: 'ada@example.com', input: { name: 'Ada', verifyUrl: 'https://example.com/verify/ada' } },
    { bullmq: { delay: 1000, attempts: 3, backoff: { type: 'exponential', delay: 500 } } },
  );

  const batch = await mail.welcome.queueBatch(
    [
      {
        to: 'bob@example.com',
        input: { name: 'Bob', verifyUrl: 'https://example.com/verify/bob' },
      },
      {
        to: 'carol@example.com',
        input: { name: 'Carol', verifyUrl: 'https://example.com/verify/carol' },
      },
    ],
    { bullmq: { attempts: 3 } },
  );

  console.log(`batch enqueued via addBulk → ${batch.okCount} ok, ${batch.errorCount} rejected`);

  await worker.close();
  await queue.close();
  await connection.quit();
};
