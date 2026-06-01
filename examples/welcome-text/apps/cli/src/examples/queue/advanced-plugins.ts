import { createNotify, createClient, consoleLogger, type Plugin } from '@betternotify/core';
import { createMockQueue, createQueueWorker, type JobResult } from '@betternotify/core/queue';
import { emailChannel } from '@betternotify/email';
import { z } from 'zod';
import { mockTransport } from '../../test-utils';

type Ctx = { tenantId?: string; requestId?: string };

const ch = emailChannel({
  defaults: { from: { name: 'Welcome Bot', email: 'noreply@example.com' } },
});

const rpc = createNotify<{ email: typeof ch }, Ctx>({ channels: { email: ch } });

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

type AuditEntry = { messageId: string; route: string; tenantId?: string; requestId?: string };
const auditLog: AuditEntry[] = [];

const requestIdPlugin: Plugin = {
  name: 'request-id',
  middleware: [
    async ({ ctx, next }) => {
      const requestId = (ctx as Ctx).requestId ?? crypto.randomUUID();
      return next({ requestId });
    },
  ],
};

const metricsPlugin: Plugin = {
  name: 'metrics',
  hooks: {
    onAfterSend: ({ route, durationMs, ctx }) => {
      const c = ctx as Ctx;
      console.log(
        `[metrics] ${route} sent in ${durationMs.toFixed(1)}ms tenant=${c.tenantId} req=${c.requestId?.slice(0, 8)}`,
      );
    },
    onError: ({ route, error, phase }) =>
      console.log(`[metrics] ${route} FAILED phase=${phase} code=${error.code}`),
  },
};

const auditPlugin: Plugin = {
  name: 'audit',
  hooks: {
    onAfterSend: ({ route, ctx, result }) => {
      const c = ctx as Ctx;
      auditLog.push({
        messageId: result.messageId,
        route,
        tenantId: c.tenantId,
        requestId: c.requestId,
      });
    },
  },
};

const transportsByChannel = { email: mockTransport('mock') };

export const runQueueAdvancedPlugins = async (): Promise<void> => {
  const queue = createMockQueue();

  const mail = createClient({
    catalog,
    transportsByChannel,
    queue: queue.producer,
    logger: consoleLogger({ level: 'warn' }),
  });

  console.log('Enqueueing 2 jobs...');
  await mail.welcome.queue({
    to: 'ada@example.com',
    input: { name: 'Ada', verifyUrl: 'https://example.com/verify/ada' },
  });
  await mail.welcome.queue({
    to: 'bob@example.com',
    input: { name: 'Bob', verifyUrl: 'https://example.com/verify/bob' },
  });
  console.log(`Pending: ${queue.pending.length}`);
  console.log('--- starting worker (plugin middleware + hooks fire here) ---');

  const completed: JobResult[] = [];
  const worker = createQueueWorker({
    catalog,
    transportsByChannel,
    consumer: queue.consumer,
    concurrency: 2,
    idleDelayMs: 10,
    plugins: [requestIdPlugin, metricsPlugin, auditPlugin],
    context: (job) => ({ tenantId: 'acme-corp', requestId: job.id }),
    logger: consoleLogger({ level: 'warn' }),
  });

  worker.on('completed', (result) => {
    completed.push(result);
  });

  const running = worker.start();
  while (completed.length < 2) await new Promise((r) => setTimeout(r, 10));
  await worker.close();
  await running;

  console.log('---');
  console.log(`audit log (${auditLog.length} entries):`);

  for (const entry of auditLog) {
    console.log(
      `  ${entry.route} tenant=${entry.tenantId} req=${entry.requestId?.slice(0, 8)} id=${entry.messageId.slice(0, 8)}`,
    );
  }
};
