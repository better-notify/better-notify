import { createClient, createNotify } from '@betternotify/core';
import { env } from '../env';
import { emailChannel } from '@betternotify/email';
import z from 'zod';
import { createLogger, initLogger, type RequestLogger } from 'evlog';
import { fromLogger, type BaseLoggerLike } from '@betternotify/core/logger';
import { cloudflareEmailTransport } from '@betternotify/cloudflare-email';
import { reactEmail } from '@betternotify/react-email';
import { Welcome } from '../templates/welcome';

const toBaseLogger = (evlog: RequestLogger<Record<string, unknown>>): BaseLoggerLike => ({
  debug: (message, payload) => evlog.info(message, payload),
  info: (message, payload) => evlog.info(message, payload),
  warn: (message, payload) => evlog.warn(message, payload),
  error: (message, payload) => evlog.error(message, payload),
});

export const runCloudflareEmailLoggerEvlog = async (): Promise<void> => {
  initLogger({ pretty: true });

  const channel = emailChannel({
    defaults: { from: { name: 'Better-Notify', email: env.CF_FROM_EMAIL } },
  });

  const rpc = createNotify({ channels: { email: channel } });

  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(({ input }) => reactEmail(Welcome, input)),
  });

  const evlog = createLogger();
  const logger = fromLogger(toBaseLogger(evlog));

  const mail = createClient({
    catalog,
    transportsByChannel: {
      email: cloudflareEmailTransport({
        accountId: env.CF_ACCOUNT_ID,
        apiToken: env.CF_API_TOKEN,
      }),
    },
    logger,
  });

  const user = { id: '123', name: 'John Doe', email: env.CF_DESTINATION_EMAIL };

  evlog.set({ context: 'welcome-text', user });

  await mail.welcome.send({
    input: {
      name: user.name,
      verifyUrl: 'https://example.com/verify?token=abc123',
    },
    to: user.email,
  });

  evlog.emit();
};
