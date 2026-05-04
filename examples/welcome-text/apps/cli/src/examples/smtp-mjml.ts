import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { mjmlTemplate } from '@betternotify/mjml';
import { smtpTransport } from '@betternotify/smtp';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const rpc = createNotify({ channels: { email: ch } });
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(
      mjmlTemplate(
        `<mjml>
  <mj-body background-color="#f1f5f9">
    <mj-section background-color="#0891b2" padding="24px 32px">
      <mj-column>
        <mj-text color="#ffffff" font-size="14px" font-weight="700" letter-spacing="2px" text-transform="uppercase">Example Mail</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 32px">
      <mj-column>
        <mj-text font-size="28px" font-weight="800" color="#020617">Welcome, {{name}}.</mj-text>
        <mj-text font-size="16px" color="#475569" line-height="26px">
          Thanks for signing up. Verify your email to activate your account.
        </mj-text>
        <mj-button href="{{verifyUrl}}" background-color="#0891b2" border-radius="12px" font-size="14px" font-weight="800" letter-spacing="1.6px" text-transform="uppercase" padding="16px 32px">
          Verify Email
        </mj-button>
        <mj-text font-size="14px" color="#64748b" padding-top="24px">
          Or paste this link: {{verifyUrl}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#f8fafc" padding="28px 32px">
      <mj-column>
        <mj-text font-size="14px" font-weight="700" color="#334155">The Example Team</mj-text>
        <mj-text font-size="12px" color="#64748b">Example Inc. 123 Demo Street, Internet City</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        {
          subject: 'Welcome, {{name}}!',
          text: 'Welcome, {{name}}! Verify your email: {{verifyUrl}}',
        },
      ),
    ),
});

export const runSmtpMjml = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: smtpTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      }),
    },
    logger: consoleLogger({ level: 'info' }),
  });

  const result = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input: { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' },
  });

  console.log('messageId:', result.messageId);
  console.log('to       :', result.envelope?.to.join(', '));
  console.log('— rendered with @betternotify/mjml (responsive HTML) + SMTP transport.');
};
