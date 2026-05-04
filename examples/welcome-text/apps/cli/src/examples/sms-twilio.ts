import { createNotify, createClient } from '@betternotify/core';
import { smsChannel } from '@betternotify/sms';
import { twilioSmsTransport } from '@betternotify/twilio';
import { z } from 'zod';
import { env } from '../env';

export const runTwilio = async (): Promise<void> => {
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

  const transport = twilioSmsTransport({
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    fromNumber: env.TWILIO_FROM_NUMBER,
  });

  const notify = createClient({
    catalog,
    channels: { sms },
    transportsByChannel: { sms: transport },
  });

  const otpResult = await notify.otpCode.send({
    to: env.TWILIO_DESTINATION_NUMBER,
    input: { code: '482910' },
  });

  console.log('otp code:', { messageId: otpResult.messageId, data: otpResult.data });

  const shippingResult = await notify.orderShipped.send({
    to: env.TWILIO_DESTINATION_NUMBER,
    input: {
      orderId: 'ORD-9281',
      carrier: 'FedEx',
      trackingUrl: 'https://track.example.com/ORD-9281',
    },
  });

  console.log('order shipped:', { messageId: shippingResult.messageId, data: shippingResult.data });

  const batchResult = await notify.otpCode.batch([
    { to: env.TWILIO_DESTINATION_NUMBER, input: { code: '111111' } },
    { to: env.TWILIO_DESTINATION_NUMBER, input: { code: '222222' } },
  ]);

  console.log(`batch: ${batchResult.okCount} ok / ${batchResult.errorCount} errors`);
};
