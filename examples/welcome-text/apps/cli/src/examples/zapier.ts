import { createNotify, createClient } from '@betternotify/core';
import { zapierChannel, zapierChannelTransport } from '@betternotify/zapier';
import { z } from 'zod';
import { env } from '../env';

const events = z.enum(['order.created', 'payment.failed', 'refund.issued']);
type Events = z.infer<typeof events>;

export const runZapier = async (): Promise<void> => {
  const zapier = zapierChannel<Events>();
  const rpc = createNotify({ channels: { zapier } });

  const catalog = rpc.catalog({
    orderCreated: rpc
      .zapier()
      .input(
        z.object({
          orderId: z.string(),
          customerEmail: z.string(),
          items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.number() })),
          total: z.number(),
        }),
      )
      .event('order.created')
      .data(({ input }) => ({
        orderId: input.orderId,
        customerEmail: input.customerEmail,
        items: input.items,
        total: input.total,
      }))
      .meta(() => ({ source: 'checkout', priority: 'normal' })),

    paymentFailed: rpc
      .zapier()
      .input(z.object({ orderId: z.string(), reason: z.string(), customerEmail: z.string() }))
      .event('payment.failed')
      .data(({ input }) => ({
        orderId: input.orderId,
        reason: input.reason,
        customerEmail: input.customerEmail,
      }))
      .meta(() => ({ priority: 'high' })),

    refundIssued: rpc
      .zapier()
      .input(z.object({ orderId: z.string(), amount: z.number() }))
      .event('refund.issued')
      .data(({ input }) => ({ orderId: input.orderId, amount: input.amount }))
      .webhookUrl('https://hooks.zapier.com/hooks/catch/999/refunds'),
  });

  const transport = zapierChannelTransport({
    webhookUrl: env.ZAPIER_WEBHOOK_URL,
  });

  const notify = createClient({
    catalog,
    channels: { zapier },
    transportsByChannel: { zapier: transport },
  });

  const orderResult = await notify.orderCreated.send({
    input: {
      orderId: 'ORD-100',
      customerEmail: 'alice@example.com',
      items: [
        { name: 'Widget Pro', qty: 2, price: 29.99 },
        { name: 'Cable', qty: 1, price: 9.99 },
      ],
      total: 69.97,
    },
  });

  console.log('order.created:', { messageId: orderResult.messageId, data: orderResult.data });

  const failResult = await notify.paymentFailed.send({
    input: {
      orderId: 'ORD-101',
      reason: 'card_declined',
      customerEmail: 'bob@example.com',
    },
  });

  console.log('payment.failed:', { messageId: failResult.messageId, data: failResult.data });

  console.log('---');
  console.log(
    'Each event posts structured JSON to the Zapier catch hook. Use per-route webhookUrl for routing different events to separate Zaps.',
  );
};
