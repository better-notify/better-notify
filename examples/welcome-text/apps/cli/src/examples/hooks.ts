import { createClient, createEmailRpc, type ClientHooks } from '@emailrpc/core';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const rpc = createEmailRpc();
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

const trail: string[] = [];
const log = (line: string): void => {
  trail.push(line);
};

const hooks: ClientHooks<typeof catalog> = {
  onBeforeSend: [
    ({ route, messageId }) => log(`onBeforeSend#1 route=${route} id=${messageId.slice(0, 8)}`),
    ({ input }) => log(`onBeforeSend#2 name=${(input as { name: string }).name}`),
  ],
  onExecute: ({ rendered }) =>
    log(`onExecute    subject="${rendered.subject}" attachments=${rendered.attachments.length}`),
  onAfterSend: [
    ({ result, durationMs }) =>
      log(`onAfterSend#1 ok in ${durationMs.toFixed(1)}ms accepted=${result.accepted.join(',')}`),
    ({ result }) => log(`onAfterSend#2 messageId=${result.messageId.slice(0, 8)}`),
  ],
  onError: [
    ({ error, phase }) => log(`onError#1     phase=${phase} code=${error.code}`),
    ({ error }) => log(`onError#2     msg="${error.message}"`),
  ],
};

export const runHooks = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    transports: [{ name: 'mock', priority: 1, transport: mockTransport('mock') }],
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
    hooks,
  });

  log('--- successful send ---');
  await mail.welcome.send({ to: 'alice@example.com', input: { name: 'Alice' } });

  log('');
  log('--- failed send (validation) ---');
  await mail.welcome
    .send({
      to: 'bob@example.com',
      input: { name: 42 as unknown as string },
    })
    .catch(() => {});

  for (const line of trail) console.log(line);
};
