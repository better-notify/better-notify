import { createNotify, createClient } from '@betternotify/core';
import { telegramChannel, telegramTransport, md } from '@betternotify/telegram';
import { z } from 'zod';
import { env } from '../env';

export const runTelegram = async (): Promise<void> => {
  const rpc = createNotify({ channels: { telegram: telegramChannel() } });

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
        ({ input }) =>
          `<b>${input.service}</b> deployed v${input.version}\nStatus: ${input.status}`,
      )
      .parseMode('HTML'),
    chartReport: rpc
      .telegram()
      .input(z.object({ chartUrl: z.string(), summary: z.string() }))
      .body(({ input }) => input.summary)
      .attachment(({ input }) => ({ type: 'photo', url: input.chartUrl })),
    markdownAlert: rpc
      .telegram()
      .input(z.object({ service: z.string(), version: z.string(), status: z.string() }))
      .body(
        ({ input }) =>
          md`# Markdown Alert\n*${input.service}* deployed v${input.version}\nStatus: ${input.status}`,
      )
      .parseMode('MarkdownV2'),
  });

  const transport = telegramTransport({ token: env.TELEGRAM_BOT_TOKEN });
  const notify = createClient({
    catalog,
    channels: { telegram: telegramChannel() },
    transportsByChannel: { telegram: transport },
  });

  const deployResult = await notify.deployAlert.send({
    to: env.TELEGRAM_CHAT_ID,
    input: { service: 'api', version: '2.4.0', status: 'healthy' },
  });

  const chartResult = await notify.chartReport.send({
    to: env.TELEGRAM_CHAT_ID,
    input: { chartUrl: 'https://placehold.co/600x400.png', summary: 'Weekly metrics report' },
  });

  const markdownResult = await notify.markdownAlert.send({
    to: env.TELEGRAM_CHAT_ID,
    input: { service: 'api', version: '2.4.0', status: 'healthy' },
  });

  console.log('deploy alert:', { messageId: deployResult.messageId, data: deployResult.data });
  console.log('chart report:', { messageId: chartResult.messageId, data: chartResult.data });
  console.log('markdown alert:', {
    messageId: markdownResult.messageId,
    data: markdownResult.data,
  });
  console.log('---');
};
