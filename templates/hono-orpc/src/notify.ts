import { createNotify, createClient } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { multiTransport } from '@betternotify/core/transports';
import { smtpTransport } from '@betternotify/smtp';
import { resendTransport } from '@betternotify/resend';
import { reactEmail } from '@betternotify/react-email';
import { z } from 'zod';
import { Welcome } from './emails/welcome';

const transport = multiTransport({
  name: 'failover',
  strategy: 'failover',
  transports: [
    {
      transport: smtpTransport({
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
      }),
    },
    {
      transport: resendTransport({ apiKey: process.env.RESEND_API_KEY! }),
    },
  ],
});

const ch = emailChannel({
  defaults: {
    from: {
      name: process.env.FROM_NAME ?? 'My App',
      email: process.env.FROM_EMAIL ?? 'noreply@example.com',
    },
  },
});

const rpc = createNotify({ channels: { email: ch } });

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(({ input }) => reactEmail(Welcome, input)),
});

export const notificationService = createClient({
  catalog,
  channels: { email: ch },
  transportsByChannel: { email: transport },
});
