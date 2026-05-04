import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { handlebarsTemplate } from '@betternotify/handlebars';
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
      handlebarsTemplate(
        `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
  <h1 style="color: #0891b2;">Welcome, {{name}}!</h1>
  <p>Thanks for signing up. Verify your email to get started:</p>
  <a href="{{verifyUrl}}" style="display: inline-block; padding: 12px 24px; background: #0891b2; color: white; border-radius: 8px; text-decoration: none;">Verify Email</a>
  <p style="margin-top: 24px; color: #64748b; font-size: 14px;">
    Or paste this link: {{verifyUrl}}
  </p>
</div>`,
        {
          subject: 'Welcome, {{name}}!',
          text: 'Welcome, {{name}}! Verify your email: {{verifyUrl}}',
        },
      ),
    ),
});

export const runSmtpHandlebars = async (): Promise<void> => {
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
  console.log('— rendered with @betternotify/handlebars + SMTP transport.');
};
