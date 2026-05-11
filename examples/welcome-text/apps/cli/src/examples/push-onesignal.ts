import { createNotify, createClient } from '@betternotify/core';
import { pushChannel } from '@betternotify/push';
import { onesignalPushTransport } from '@betternotify/onesignal';
import { z } from 'zod';
import { env } from '../env';

export const runPushOnesignal = async (): Promise<void> => {
  const push = pushChannel();
  const rpc = createNotify({ channels: { push } });

  const catalog = rpc.catalog({
    orderReady: rpc
      .push()
      .input(z.object({ orderId: z.string(), storeName: z.string() }))
      .title(({ input }) => `Order ${input.orderId} ready!`)
      .body(({ input }) => `Your order is ready for pickup at ${input.storeName}.`)
      .data(({ input }) => ({ deeplink: `/orders/${input.orderId}` }))
      .badge(1),
    promoAlert: rpc
      .push()
      .input(z.object({ title: z.string(), message: z.string(), promoCode: z.string() }))
      .title(({ input }) => input.title)
      .body(({ input }) => input.message)
      .data(({ input }) => ({ promoCode: input.promoCode, deeplink: '/promos' })),
  });

  const transport = onesignalPushTransport<typeof catalog>({
    appId: env.ONESIGNAL_APP_ID,
    apiKey: env.ONESIGNAL_API_KEY,
    body: { ttl: 259200, isIos: true, isAndroid: true },
    bodyFor: {
      orderReady: { priority: 10, ios_sound: 'order_ready.wav' },
      promoAlert: { priority: 5, collapse_id: 'promo' },
    },
  });

  const notify = createClient({
    catalog,
    channels: { push },
    transportsByChannel: { push: transport },
  });

  const orderResult = await notify.orderReady.send({
    to: 'subscription-id-abc',
    input: { orderId: 'ORD-4521', storeName: 'Downtown Cafe' },
    /**
     * Override the priority for this send
     */
    transport: {
      onesignal: {
        priority: 10,
      },
    },
  });

  console.log('order ready:', { messageId: orderResult.messageId, data: orderResult.data });

  const promoResult = await notify.promoAlert.send({
    to: ['subscription-id-abc', 'subscription-id-def'],
    input: {
      title: 'Flash Sale!',
      message: '50% off all items for the next 2 hours',
      promoCode: 'FLASH50',
    },
  });

  console.log('promo alert:', { messageId: promoResult.messageId, data: promoResult.data });
};
