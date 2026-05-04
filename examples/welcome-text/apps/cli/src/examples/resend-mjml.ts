import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { mjmlTemplate } from '@betternotify/mjml';
import { resendTransport } from '@betternotify/resend';
import { z } from 'zod';
import { env } from '../env';

const ch = emailChannel({
  defaults: { from: { email: env.RESEND_FROM_EMAIL } },
});
const rpc = createNotify({ channels: { email: ch } });
const catalog = rpc.catalog({
  passwordReset: rpc
    .email()
    .input(z.object({ name: z.string(), resetUrl: z.string().url(), expiresIn: z.string() }))
    .subject(({ input }) => `Reset your password, ${input.name}`)
    .template(
      mjmlTemplate(
        `<mjml>
  <mj-body background-color="#f8fafc">
    <mj-section background-color="#dc2626" padding="20px 32px">
      <mj-column>
        <mj-text color="#ffffff" font-size="14px" font-weight="700" letter-spacing="2px" text-transform="uppercase">Security Alert</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="40px 32px">
      <mj-column>
        <mj-text font-size="24px" font-weight="800" color="#020617">Password Reset</mj-text>
        <mj-text font-size="16px" color="#475569" line-height="26px">
          Hi {{name}}, we received a request to reset your password. Click below to choose a new one:
        </mj-text>
        <mj-button href="{{resetUrl}}" background-color="#dc2626" border-radius="8px" font-size="14px" font-weight="700">
          Reset Password
        </mj-button>
        <mj-text font-size="14px" color="#94a3b8" padding-top="20px">
          This link expires in {{expiresIn}}. If you didn't request this, ignore this email.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
        {
          subject: 'Reset your password, {{name}}',
          text: 'Hi {{name}}, reset your password here: {{resetUrl}} (expires in {{expiresIn}})',
        },
      ),
    ),
});

export const runResendMjml = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: {
      email: resendTransport({ apiKey: env.RESEND_API_KEY }),
    },
    logger: consoleLogger({ level: 'info' }),
  });

  const result = await mail.passwordReset.send({
    to: env.RESEND_DESTINATION_EMAIL,
    input: {
      name: 'Alice',
      resetUrl: 'https://example.com/reset?token=xyz789',
      expiresIn: '15 minutes',
    },
  });

  console.log('messageId:', result.messageId);
  console.log('— Password reset email rendered with MJML (responsive) + Resend transport.');
};
