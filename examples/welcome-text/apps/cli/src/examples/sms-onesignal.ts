import { createNotify, createClient } from '@betternotify/core';
import { smsChannel } from '@betternotify/sms';
import { onesignalSmsTransport } from '@betternotify/onesignal';
import { z } from 'zod';
import { env } from '../env';

export const runSmsOnesignal = async (): Promise<void> => {
  const sms = smsChannel();
  const rpc = createNotify({ channels: { sms } });

  const catalog = rpc.catalog({
    otpCode: rpc
      .sms()
      .input(z.object({ code: z.string().length(6) }))
      .body(({ input }) => `Your verification code is ${input.code}. It expires in 10 minutes.`),
    orderShipped: rpc
      .sms()
      .input(z.object({ orderId: z.string(), carrier: z.string(), trackingUrl: z.url() }))
      .body(
        ({ input }) =>
          `Your order ${input.orderId} has shipped via ${input.carrier}. Track it: ${input.trackingUrl}`,
      ),
  });

  const transport = onesignalSmsTransport<typeof catalog>({
    appId: env.ONESIGNAL_APP_ID,
    apiKey: env.ONESIGNAL_API_KEY,
    from: env.ONESIGNAL_SMS_FROM,
    body: { enable_frequency_cap: true },
    bodyFor: {
      otpCode: { priority: 10 },
      orderShipped: { ttl: 86400 },
    },
  });

  const notify = createClient({
    catalog,
    channels: { sms },
    transportsByChannel: { sms: transport },
  });

  const otpResult = await notify.otpCode.send({
    to: '+15559876543',
    input: { code: '482910' },
  });

  console.log('otp code:', { messageId: otpResult.messageId, data: otpResult.data });

  const shippingResult = await notify.orderShipped.send({
    to: '+15559876543',
    input: {
      orderId: 'ORD-9281',
      carrier: 'FedEx',
      trackingUrl: 'https://track.example.com/ORD-9281',
    },
  });

  console.log('order shipped:', { messageId: shippingResult.messageId, data: shippingResult.data });
};
