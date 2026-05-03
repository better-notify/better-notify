import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { resendTransport } from '@betternotify/resend';
import { z } from 'zod';
import { env } from '../env';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const pdfBuffer = await readFile(path.join(import.meta.dirname, '../test-utils/example-pdf.pdf'));

const ch = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.RESEND_FROM_EMAIL } },
});

const rpc = createNotify({ channels: { email: ch } });

const catalog = rpc.catalog({
  invoice: rpc
    .email()
    .input(z.object({ orderId: z.string(), customerName: z.string() }))
    .subject(({ input }) => `Invoice for order #${input.orderId}`)
    .template({
      render: async ({ input }) => ({
        html: `<p>Hi ${input.customerName},</p><p>Please find your invoice for order <strong>#${input.orderId}</strong> attached.</p>`,
        text: `Hi ${input.customerName}, please find your invoice for order #${input.orderId} attached.`,
      }),
    }),
});

export const runResendAttachment = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: resendTransport({
        apiKey: env.RESEND_API_KEY,
      }),
    },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await mail.invoice.send({
    to: env.RESEND_DESTINATION_EMAIL,
    input: { orderId: '12345', customerName: 'John Doe' },
    attachments: [
      {
        filename: 'invoice-12345.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log('Message ID:', result.messageId);
  console.log('From:      ', result.envelope?.from);
  console.log('To:        ', result.envelope?.to.join(', '));
  console.log('Render:    ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${result.timing.sendMs.toFixed(1)}ms`);
};
