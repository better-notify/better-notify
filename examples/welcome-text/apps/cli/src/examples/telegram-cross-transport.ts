import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { multiTransport, createTransport } from '@betternotify/core/transports';
import {
  telegramChannel,
  telegramTransport,
  type RenderedTelegram,
  type TelegramTransportData,
} from '@betternotify/telegram';
import { smtpTransport } from '@betternotify/smtp';
import { z } from 'zod';
import { env } from '../env';

const telegram = telegramChannel();
const rpc = createNotify({ channels: { telegram } });

const catalog = rpc.catalog({
  deployAlert: rpc
    .telegram()
    .input(
      z.object({
        service: z.enum(['api', 'web']),
        version: z.string(),
        status: z.enum(['healthy', 'unhealthy']),
      }),
    )
    .body(
      ({ input }) => `<b>${input.service}</b> deployed v${input.version}\nStatus: ${input.status}`,
    )
    .parseMode('HTML'),
});

const smtp = smtpTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

const smtpMirror = createTransport<RenderedTelegram, TelegramTransportData>({
  name: 'smtp-mirror',
  send: async (rendered, ctx) => {
    await smtp.send(
      {
        from: { email: env.SMTP_USER, name: 'Deploy Bot' },
        to: [{ email: env.SMTP_DESTINATION_EMAIL }],
        subject: `[${ctx.route}] Telegram notification`,
        html: `<p>${rendered.body}</p>`,
      },
      ctx,
    );

    return { ok: true, data: { messageId: 0, chatId: rendered.to ?? 0 } };
  },
});

const transport = multiTransport({
  name: 'telegram+smtp',
  strategy: 'mirrored',
  transports: [
    { transport: telegramTransport({ token: env.TELEGRAM_BOT_TOKEN }) },
    { transport: smtpMirror },
  ],
  logger: consoleLogger({ level: 'debug' }),
});

export const runTelegramCrossTransport = async (): Promise<void> => {
  const notify = createClient({
    catalog,
    channels: { telegram },
    transportsByChannel: { telegram: transport },
    logger: consoleLogger({ level: 'debug' }),
  });

  const result = await notify.deployAlert.send({
    to: env.TELEGRAM_CHAT_ID,
    input: { service: 'api', version: '2.4.0', status: 'healthy' },
  });

  console.log('Message ID:', result.messageId);
  console.log('Telegram delivered + SMTP mirror fired in background');
  await new Promise((r) => setTimeout(r, 100));
};
