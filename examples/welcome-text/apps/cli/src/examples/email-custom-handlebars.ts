import Handlebars from 'handlebars';
import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { handlebarsTemplate } from '@betternotify/handlebars';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const hbs = Handlebars.create();

hbs.registerHelper('currency', (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount),
);

hbs.registerHelper('date', (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
);

hbs.registerHelper('uppercase', (str: string) => str.toUpperCase());

hbs.registerPartial(
  'footer',
  `<tr>
  <td style="padding: 24px 32px; background: #f8fafc; font-size: 12px; color: #64748b;">
    <p style="margin: 0;">Acme Inc. · 123 Demo Street · Internet City</p>
    <p style="margin: 8px 0 0;">You received this because you have an account with us.</p>
  </td>
</tr>`,
);

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});

const rpc = createNotify({ channels: { email: ch } });

const catalog = rpc.catalog({
  invoice: rpc
    .email()
    .input(
      z.object({
        customerName: z.string(),
        invoiceId: z.string(),
        issuedAt: z.string(),
        dueDate: z.string(),
        items: z.array(z.object({ description: z.string(), amount: z.number() })),
        total: z.number(),
      }),
    )
    .subject(({ input }) => `Invoice #${input.invoiceId}`)
    .template(
      handlebarsTemplate(
        `<table style="font-family: sans-serif; max-width: 560px; margin: 0 auto; border-collapse: collapse;">
  <tr>
    <td style="padding: 32px; background: #0891b2;">
      <h1 style="margin: 0; color: white; font-size: 20px;">Invoice #{{invoiceId}}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 32px;">
      <p>Hi {{customerName}},</p>
      <p>Here's your invoice issued on <strong>{{date issuedAt}}</strong>, due by <strong>{{date dueDate}}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr style="border-bottom: 2px solid #e2e8f0;">
          <th style="text-align: left; padding: 8px 0;">Description</th>
          <th style="text-align: right; padding: 8px 0;">Amount</th>
        </tr>
        {{#each items}}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0;">{{this.description}}</td>
          <td style="text-align: right; padding: 10px 0;">{{currency this.amount}}</td>
        </tr>
        {{/each}}
        <tr>
          <td style="padding: 12px 0; font-weight: 700;">Total</td>
          <td style="text-align: right; padding: 12px 0; font-weight: 700; font-size: 18px;">{{currency total}}</td>
        </tr>
      </table>
    </td>
  </tr>
  {{> footer}}
</table>`,
        {
          handlebars: hbs,
          text: 'Invoice #{{invoiceId}} for {{currency total}} — due {{date dueDate}}',
        },
      ),
    ),
});

export const runEmailCustomHandlebars = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    logger: consoleLogger({ level: 'info' }),
  });

  const result = await mail.invoice.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: {
      customerName: 'Alice Johnson',
      invoiceId: 'INV-2024-0042',
      issuedAt: '2024-11-15T00:00:00Z',
      dueDate: '2024-12-15T00:00:00Z',
      items: [
        { description: 'Consulting (10 hours)', amount: 1500 },
        { description: 'Design review', amount: 750 },
        { description: 'Infrastructure setup', amount: 2000 },
      ],
      total: 4250,
    },
  });

  console.log('messageId:', result.messageId);
  console.log('— Custom Handlebars instance with currency/date helpers and shared footer partial.');
};
