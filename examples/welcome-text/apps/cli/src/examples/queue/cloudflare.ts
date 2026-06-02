import { createNotify, createClient } from '@betternotify/core';
import {
  createJobProcessor,
  createQueueRouter,
  createQueueProducer,
  type JobEnvelope,
} from '@betternotify/core/queue';
import { emailChannel } from '@betternotify/email';
import { z } from 'zod';
import { mockTransport } from '../../test-utils';

export type CloudflareEnqueueData = { delaySeconds?: number; contentType?: string };

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface QueueDataMap {
    cloudflare: CloudflareEnqueueData;
  }
}

type CfQueueMessage<Body> = {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: Body;
  ack(): void;
  retry(): void;
};

type CfMessageBatch<Body> = {
  readonly queue: string;
  readonly messages: ReadonlyArray<CfQueueMessage<Body>>;
};

type CfQueue<Body> = {
  send(body: Body, options?: CloudflareEnqueueData): Promise<void>;
  sendBatch(messages: Iterable<{ body: Body } & CloudflareEnqueueData>): Promise<void>;
};

type Env = { QUEUE: CfQueue<JobEnvelope> };

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: 'noreply@example.com' } },
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

export const makeCloudflareProducer = (queue: CfQueue<JobEnvelope>) =>
  createQueueProducer({
    enqueue: async (envelope, opts) => {
      await queue.send(envelope, opts?.cloudflare);
      return { id: envelope.id };
    },
    enqueueBatch: async (envelopes, opts) => {
      await queue.sendBatch(envelopes.map((body) => ({ body, ...opts?.cloudflare })));
      return envelopes.map((envelope) => ({ id: envelope.id }));
    },
  });

export const enqueueFromWorker = (env: Env) =>
  createClient({ catalog, transportsByChannel, queue: makeCloudflareProducer(env.QUEUE) });

export const enqueueManyFromWorker = (env: Env) =>
  enqueueFromWorker(env).welcome.queueBatch([
    { to: 'bob@example.com', input: { name: 'Bob', verifyUrl: 'https://example.com/verify/bob' } },
    {
      to: 'carol@example.com',
      input: { name: 'Carol', verifyUrl: 'https://example.com/verify/carol' },
    },
  ]);

const processor = createJobProcessor({ catalog, transportsByChannel });

export default {
  async queue(batch: CfMessageBatch<JobEnvelope>): Promise<void> {
    for (const message of batch.messages) {
      const result = await processor.process(message.body);
      if (result.status === 'retry') message.retry();
      else message.ack();
    }
  },
};

const router = createQueueRouter({
  'tx-emails': processor,
  'mkt-emails': processor,
});

export const multiCatalogQueue = async (batch: CfMessageBatch<JobEnvelope>): Promise<void> => {
  const routed = router.route(batch.queue);
  if (!routed) {
    console.error(`no processor for queue "${batch.queue}"`);
    return;
  }
  for (const message of batch.messages) {
    const result = await routed.process(message.body);
    if (result.status === 'retry') message.retry();
    else message.ack();
  }
};
