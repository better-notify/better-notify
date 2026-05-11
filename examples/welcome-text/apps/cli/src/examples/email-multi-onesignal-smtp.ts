import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { multiTransport } from '@betternotify/email/transports';
import { onesignalEmailTransport } from '@betternotify/onesignal';
import { smtpTransport } from '@betternotify/smtp';
import { z } from 'zod';
import { env } from '../env';

const email = emailChannel({
  defaults: { from: { name: 'Better-Notify', email: env.ONESIGNAL_FROM_EMAIL } },
});

const rpc = createNotify({ channels: { email } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}! Verify here: ${input.verifyUrl}`,
        html: `<p>Welcome, ${input.name}! <a href="${input.verifyUrl}">Verify</a></p>`,
      }),
    }),
  passwordReset: rpc
    .email()
    .input(z.object({ resetUrl: z.string().url() }))
    .subject(() => 'Reset your password')
    .template({
      render: async ({ input }) => ({
        text: `Reset your password: ${input.resetUrl}`,
        html: `<p><a href="${input.resetUrl}">Reset your password</a></p>`,
      }),
    }),
});

export const runEmailMultiOnesignalSmtp = async (): Promise<void> => {
  const logger = consoleLogger({ level: 'debug' });

  const composite = multiTransport({
    name: 'onesignal-smtp-failover',
    strategy: 'failover',
    transports: [
      {
        transport: onesignalEmailTransport<typeof catalog>({
          appId: env.ONESIGNAL_APP_ID,
          apiKey: env.ONESIGNAL_API_KEY,
          body: { disable_email_click_tracking: true },
          bodyFor: {
            welcome: { email_preheader: 'Verify your account to get started' },
          },
        }),
      },
      {
        transport: smtpTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        }),
      },
    ],
    logger,
  });

  const mail = createClient({
    catalog,
    channels: { email },
    transportsByChannel: { email: composite },
    logger,
  });

  const welcomeResult = await mail.welcome.send({
    to: env.ONESIGNAL_DESTINATION_EMAIL,
    input: { name: 'Alice', verifyUrl: 'https://example.com/verify?token=abc' },
    transport: {
      onesignal: { send_after: '2026-06-01T09:00:00Z' },
    },
  });

  console.log('--- welcome ---');
  console.log('Message ID:', welcomeResult.messageId);
  console.log('Render:    ', `${welcomeResult.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${welcomeResult.timing.sendMs.toFixed(1)}ms`);

  const resetResult = await mail.passwordReset.send({
    to: env.ONESIGNAL_DESTINATION_EMAIL,
    input: { resetUrl: 'https://example.com/reset?token=xyz' },
  });

  console.log('--- password reset ---');
  console.log('Message ID:', resetResult.messageId);
  console.log('Render:    ', `${resetResult.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${resetResult.timing.sendMs.toFixed(1)}ms`);
};
