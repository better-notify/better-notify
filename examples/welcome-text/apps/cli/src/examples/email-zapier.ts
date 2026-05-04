import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { zapierTransport } from '@betternotify/zapier';
import { z } from 'zod';
import { env } from '../env';

export const runEmailZapier = async (): Promise<void> => {
  const rpc = createNotify({ channels: { email: emailChannel() } });

  const catalog = rpc.catalog({
    orderConfirmation: rpc
      .email()
      .input(
        z.object({
          orderId: z.string(),
          customerName: z.string(),
          total: z.number(),
        }),
      )
      .from({ name: 'Acme Store', email: 'orders@acme.com' })
      .subject(({ input }) => `Order #${input.orderId} confirmed`)
      .template({
        render: async ({ input }) => ({
          html: `<h1>Thanks, ${input.customerName}!</h1><p>Your order #${input.orderId} for $${input.total} has been confirmed.</p>`,
          text: `Thanks, ${input.customerName}! Your order #${input.orderId} for $${input.total} has been confirmed.`,
        }),
      }),
  });

  const transport = zapierTransport({
    webhookUrl: env.ZAPIER_WEBHOOK_URL,
  });

  const notify = createClient({
    catalog,
    channels: { email: emailChannel() },
    transportsByChannel: { email: transport },
  });

  const result = await notify.orderConfirmation.send({
    to: 'customer@example.com',
    input: { orderId: 'ORD-9001', customerName: 'Alice', total: 149.99 },
  });

  console.log('email via zapier:', { messageId: result.messageId, data: result.data });
  console.log('---');
  console.log(
    'Zapier receives the full email payload (HTML, subject, addresses) and can route it to Gmail, SendGrid, or any email action.',
  );
};
