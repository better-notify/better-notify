import { createNotify, createClient } from '@betternotify/core';
import { zapierChannel, zapierChannelTransport } from '@betternotify/zapier';
import { discordChannel, mockDiscordTransport } from '@betternotify/discord';
import { z } from 'zod';
import { env } from '../env';

export const runDiscordZapier = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { zapier: zapierChannel(), discord: discordChannel() },
  });

  const catalog = rpc.catalog({
    orderCreated: rpc
      .zapier()
      .input(
        z.object({
          orderId: z.string(),
          customerEmail: z.string(),
          items: z.array(z.object({ name: z.string(), qty: z.number() })),
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
      .meta(() => ({ source: 'api', priority: 'normal' })),

    highValueOrder: rpc
      .zapier()
      .input(z.object({ orderId: z.string(), total: z.number(), customerEmail: z.string() }))
      .event('order.high_value')
      .data(({ input }) => ({
        orderId: input.orderId,
        total: input.total,
        customerEmail: input.customerEmail,
      }))
      .meta(() => ({ priority: 'high' }))
      .webhookUrl('https://hooks.zapier.com/hooks/catch/999/vip-orders'),

    deployAlert: rpc
      .discord()
      .input(z.object({ service: z.string(), version: z.string() }))
      .body(({ input }) => `Deployed **${input.service}** v${input.version}`),
  });

  const zapierTransportInstance = zapierChannelTransport({
    webhookUrl: env.ZAPIER_WEBHOOK_URL,
  });

  const notify = createClient({
    catalog,
    channels: { zapier: zapierChannel(), discord: discordChannel() },
    transportsByChannel: {
      zapier: zapierTransportInstance,
      discord: mockDiscordTransport(),
    },
  });

  const orderResult = await notify.orderCreated.send({
    input: {
      orderId: 'ORD-42',
      customerEmail: 'bob@example.com',
      items: [
        { name: 'Widget', qty: 2 },
        { name: 'Gadget', qty: 1 },
      ],
      total: 89.97,
    },
  });

  console.log('zapier order.created:', { messageId: orderResult.messageId, data: orderResult.data });

  const vipResult = await notify.highValueOrder.send({
    input: { orderId: 'ORD-43', total: 5000, customerEmail: 'whale@corp.com' },
  });

  console.log('zapier order.high_value (VIP URL):', {
    messageId: vipResult.messageId,
    data: vipResult.data,
  });

  const discordResult = await notify.deployAlert.send({
    input: { service: 'api', version: '3.0.0' },
  });

  console.log('discord deploy:', { messageId: discordResult.messageId, data: discordResult.data });
  console.log('---');
  console.log(
    'Zapier channel sends structured JSON to catch hooks. Use per-route webhookUrl for routing to different Zaps.',
  );
};
