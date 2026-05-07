import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { multiTransport } from '@betternotify/email/transports';
import { smtpTransport } from '@betternotify/smtp';
import { resendTransport } from '@betternotify/resend';
import { zapierTransport } from '@betternotify/zapier';
import { discordChannel, discordTransport } from '@betternotify/discord';
import { telegramChannel, telegramTransport } from '@betternotify/telegram';
import { z } from 'zod';
import { env } from '../env';

const welcomeInput = z.object({ name: z.string(), verifyUrl: z.string().url() });

const email = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const discord = discordChannel();
const telegram = telegramChannel();

const rpc = createNotify({ channels: { email, discord, telegram } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(welcomeInput)
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}! Verify here: ${input.verifyUrl}`,
        html: `<p>Welcome, ${input.name}! <a href="${input.verifyUrl}">Verify</a></p>`,
      }),
    }),
  welcomeDiscord: rpc
    .discord()
    .input(welcomeInput)
    .body(({ input }) => `New signup: **${input.name}**`)
    .embeds(({ input }) => [
      {
        title: `Welcome ${input.name}`,
        description: `Verification link: ${input.verifyUrl}`,
        color: 0x57f287,
      },
    ]),
  welcomeTelegram: rpc
    .telegram()
    .input(welcomeInput)
    .body(({ input }) => `New signup: <b>${input.name}</b>\nVerify: ${input.verifyUrl}`)
    .parseMode('HTML'),
});

export const runEmailSmtpFailover = async (): Promise<void> => {
  const logger = consoleLogger({ level: 'debug' });

  const composite = multiTransport({
    name: 'smtp-failover',
    strategy: 'failover',
    transports: [
      {
        transport: smtpTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        }),
      },
      {
        transport: resendTransport({
          apiKey: env.RESEND_API_KEY,
        }),
      },
      {
        transport: zapierTransport({
          webhookUrl: env.ZAPIER_WEBHOOK_URL,
        }),
      },
    ],
    logger,
  });

  const mail = createClient({
    catalog,
    channels: { email, discord, telegram },
    transportsByChannel: {
      email: composite,
      discord: discordTransport({ webhookUrl: env.DISCORD_WEBHOOK_URL }),
      telegram: telegramTransport({ token: env.TELEGRAM_BOT_TOKEN }),
    },
    logger,
  });

  const input = { name: 'John Doe', verifyUrl: 'https://example.com/verify?token=abc123' };

  const emailResult = await mail.welcome.send({
    to: env.SMTP_DESTINATION_EMAIL,
    input,
  });

  console.log('--- email delivered ---');
  console.log('Message ID:', emailResult.messageId);
  console.log('From:      ', emailResult.envelope?.from);
  console.log('To:        ', emailResult.envelope?.to.join(', '));
  console.log('Render:    ', `${emailResult.timing.renderMs.toFixed(1)}ms`);
  console.log('Send:      ', `${emailResult.timing.sendMs.toFixed(1)}ms`);

  const [discordResult, telegramResult] = await Promise.all([
    mail.welcomeDiscord.send({ input }),
    mail.welcomeTelegram.send({ to: env.TELEGRAM_CHAT_ID, input }),
  ]);

  console.log('--- discord + telegram dispatched ---');
  console.log('Discord:', { messageId: discordResult.messageId });
  console.log('Telegram:', { messageId: telegramResult.messageId });
};
