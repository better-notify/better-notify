import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { createMockQueue, createQueueWorker, type JobResult } from '@betternotify/core/queue';
import { withIdempotency, withTagInject } from '@betternotify/core/middlewares';
import { inMemoryIdempotencyStore } from '@betternotify/core/stores';
import { emailChannel } from '@betternotify/email';
import { createTransport, type Transport } from '@betternotify/email/transports';
import { z } from 'zod';

let sendCount = 0;
const countingTransport: Transport = createTransport({
  name: 'counting',
  send: async (message) => {
    sendCount += 1;
    const to = message.to.map((a) => (typeof a === 'string' ? a : a.email)).join(', ');
    console.log(`  transport send #${sendCount} → ${to}`);
    return { ok: true, data: { accepted: [], rejected: [] } };
  },
});

const ch = emailChannel({
  defaults: { from: { name: 'Welcome Bot', email: 'noreply@example.com' } },
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
    })
    .use(
      withIdempotency({
        store: inMemoryIdempotencyStore(),
        key: ({ args }) => `welcome:${String(args.to)}`,
        ttl: 60_000,
      }),
    )
    .use(withTagInject({ tags: { source: 'queue', tier: 'transactional' } }))
    .use(async ({ ctx, route, next }) => {
      const tags = (ctx as { tagsToInject?: Record<string, string> }).tagsToInject;
      console.log(`  [mw] ${route} tags=${JSON.stringify(tags ?? {})}`);
      return next();
    }),
});

const transportsByChannel = { email: countingTransport };

export const runQueueAdvancedMiddleware = async (): Promise<void> => {
  const queue = createMockQueue();

  const mail = createClient({
    catalog,
    transportsByChannel,
    queue: queue.producer,
    logger: consoleLogger({ level: 'warn' }),
  });

  console.log('Enqueueing 3 jobs (two share a recipient → same idempotency key)...');
  await mail.welcome.queue({
    to: 'ada@example.com',
    input: { name: 'Ada', verifyUrl: 'https://example.com/verify/ada' },
  });
  await mail.welcome.queue({
    to: 'bob@example.com',
    input: { name: 'Bob', verifyUrl: 'https://example.com/verify/bob' },
  });
  await mail.welcome.queue({
    to: 'ada@example.com',
    input: { name: 'Ada', verifyUrl: 'https://example.com/verify/ada' },
  });
  console.log(`Pending: ${queue.pending.length}`);
  console.log('--- draining (middleware runs here, on the worker) ---');

  const completed: JobResult[] = [];
  const worker = createQueueWorker({
    catalog,
    transportsByChannel,
    consumer: queue.consumer,
    concurrency: 1,
    idleDelayMs: 10,
    logger: consoleLogger({ level: 'warn' }),
  });
  worker.on('completed', (result) => {
    completed.push(result);
  });

  const running = worker.start();
  while (completed.length < 3) await new Promise((r) => setTimeout(r, 10));
  await worker.close();
  await running;

  console.log('---');
  console.log(`Jobs processed: ${completed.length}`);
  console.log(
    `Transport sends: ${sendCount} — idempotency deduped the repeated recipient on the worker.`,
  );
};
