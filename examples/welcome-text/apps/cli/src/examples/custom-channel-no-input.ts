import { createNotify, createClient, defineChannel, slot } from '@betternotify/core';
import { createMockTransport } from '@betternotify/core/transports';
import { z } from 'zod';

type RenderedInbox = {
  userId: string;
  type: string;
  title: string;
};

type InboxTransportData = { id: string };

const inboxChannel = defineChannel({
  name: 'inbox' as const,
  slots: {
    type: slot.value<string>(),
    title: slot.resolver<string>(),
  },
  validateArgs: z.object({ userId: z.string() }),
  render: ({ runtime, args }): RenderedInbox => ({
    userId: args.userId,
    type: runtime.type,
    title: runtime.title,
  }),
});

export const runCustomChannelNoInput = async (): Promise<void> => {
  const rpc = createNotify({ channels: { inbox: inboxChannel } });

  const catalog = rpc.catalog({
    order: rpc.catalog({
      created: rpc.inbox().type('order.created').title('Your order is confirmed'),
      shipped: rpc
        .inbox()
        .input(z.object({ trackingUrl: z.url() }))
        .type('order.shipped')
        .title(({ input }) => `Your order shipped — track it at ${input.trackingUrl}`),
    }),
  });

  const mock = createMockTransport<RenderedInbox, InboxTransportData>({
    name: 'mock-inbox',
    reply: () => ({ id: `inbox_${Date.now()}` }),
  });

  const notify = createClient({
    catalog,
    transportsByChannel: { inbox: mock },
  });

  const created = await notify.order.created.send({ userId: 'user_42' });
  console.log('created →', created.messageId, 'data:', created.data);

  const shipped = await notify.order.shipped.send({
    userId: 'user_42',
    input: { trackingUrl: 'https://track.example.com/abc123' },
  });
  console.log('shipped →', shipped.messageId, 'data:', shipped.data);

  console.log('---');
  console.log(`captured ${mock.sent.length} sends:`);
  for (const { rendered } of mock.sent) {
    console.log(`  ${rendered.userId} ← [${rendered.type}] ${rendered.title}`);
  }

  console.log('---');
  console.log('order.created declares no .input() — sent with only its channel args, no input slot.');
};
