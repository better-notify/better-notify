import { createNotify, createClient, type Plugin } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const rpc = createNotify<{ email: typeof ch }, { requestId?: string; tenantId?: string }>({
  channels: { email: ch },
});
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        html: `<p>Welcome, ${input.name}!</p>`,
        text: `Welcome, ${input.name}!`,
      }),
    }),
});

type AuditEvent = { messageId: string; route: string; status: 'ok' | 'error'; tenantId?: string };
const auditLog: AuditEvent[] = [];

const requestIdPlugin: Plugin = {
  name: 'request-id',
  middleware: [
    async ({ next, ctx }) => {
      const requestId = (ctx as { requestId?: string }).requestId ?? crypto.randomUUID();
      console.log(`[request-id] tagging requestId=${requestId.slice(0, 8)}`);
      return next({ requestId });
    },
  ],
  onCreate: () => console.log('[request-id] onCreate'),
  onClose: () => console.log('[request-id] onClose'),
};

const metricsPlugin: Plugin = {
  name: 'metrics',
  hooks: {
    onAfterSend: ({ route, durationMs }) =>
      console.log(`[metrics] ${route} sent in ${durationMs.toFixed(1)}ms`),
    onError: ({ route, error, phase }) =>
      console.log(`[metrics] ${route} FAILED phase=${phase} code=${error.code}`),
  },
  onCreate: () => console.log('[metrics] onCreate'),
  onClose: () => console.log('[metrics] onClose'),
};

const auditPlugin: Plugin = {
  name: 'audit',
  hooks: {
    onAfterSend: ({ route, ctx, result }) => {
      auditLog.push({
        messageId: result.messageId,
        route,
        status: 'ok',
        tenantId: (ctx as { tenantId?: string }).tenantId,
      });
    },
    onError: ({ route, ctx, messageId }) => {
      auditLog.push({
        messageId,
        route,
        status: 'error',
        tenantId: (ctx as { tenantId?: string }).tenantId,
      });
    },
  },
  onCreate: () => console.log('[audit] onCreate'),
  onClose: () => console.log('[audit] onClose'),
};

export const runPlugins = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    ctx: { tenantId: 'acme-corp' } as never,
    plugins: [requestIdPlugin, metricsPlugin, auditPlugin],
  });

  console.log('---');
  await mail.welcome.send({ to: 'alice@example.com', input: { name: 'Alice' } });
  await mail.welcome.send({ to: 'bob@example.com', input: { name: 'Bob' } });

  console.log('---');
  console.log(`audit log (${auditLog.length} entries):`);
  for (const entry of auditLog) {
    console.log(
      `  ${entry.status.padEnd(5)} ${entry.route} tenant=${entry.tenantId} id=${entry.messageId.slice(0, 8)}`,
    );
  }

  console.log('---');
  await mail.close();
};
