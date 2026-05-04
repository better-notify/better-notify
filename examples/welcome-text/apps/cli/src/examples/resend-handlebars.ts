import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { handlebarsTemplate } from '@betternotify/handlebars';
import { resendTransport } from '@betternotify/resend';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { email: env.RESEND_FROM_EMAIL } },
});
const rpc = createNotify({ channels: { email: ch } });
const catalog = rpc.catalog({
  orderConfirmation: rpc
    .email()
    .input(
      z.object({
        name: z.string(),
        orderId: z.string(),
        items: z.array(z.object({ name: z.string(), qty: z.number(), price: z.string() })),
        total: z.string(),
      }),
    )
    .subject(({ input }) => `Order #${input.orderId} confirmed`)
    .template(
      handlebarsTemplate(
        `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
  <h1 style="color: #0891b2;">Order Confirmed</h1>
  <p>Hi {{name}}, your order <strong>#{{orderId}}</strong> has been confirmed.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <th style="text-align: left; padding: 8px 0;">Item</th>
      <th style="text-align: center; padding: 8px 0;">Qty</th>
      <th style="text-align: right; padding: 8px 0;">Price</th>
    </tr>
    {{#each items}}
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 0;">{{this.name}}</td>
      <td style="text-align: center; padding: 8px 0;">{{this.qty}}</td>
      <td style="text-align: right; padding: 8px 0;">{{this.price}}</td>
    </tr>
    {{/each}}
    <tr>
      <td colspan="2" style="padding: 12px 0; font-weight: 700;">Total</td>
      <td style="text-align: right; padding: 12px 0; font-weight: 700;">{{total}}</td>
    </tr>
  </table>
  <p style="color: #64748b; font-size: 14px;">We'll notify you when your order ships.</p>
</div>`,
        {
          subject: 'Order #{{orderId}} confirmed',
          text: 'Hi {{name}}, your order #{{orderId}} ({{total}}) has been confirmed.',
        },
      ),
    ),
});

export const runResendHandlebars = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: resendTransport({ apiKey: env.RESEND_API_KEY }),
    },
    logger: consoleLogger({ level: 'info' }),
  });

  const result = await mail.orderConfirmation.send({
    to: env.RESEND_DESTINATION_EMAIL,
    input: {
      name: 'Alice',
      orderId: 'ORD-9281',
      items: [
        { name: 'TypeScript Handbook', qty: 1, price: '$29.00' },
        { name: 'Node.js Stickers', qty: 3, price: '$12.00' },
      ],
      total: '$41.00',
    },
  });

  console.log('messageId:', result.messageId);
  console.log('— Order confirmation rendered with Handlebars + Resend transport.');
};
