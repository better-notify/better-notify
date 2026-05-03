import { readFileSync } from 'node:fs';
import { createNotify, createClient } from '@betternotify/core';
import { discordChannel, discordTransport } from '@betternotify/discord';
import { z } from 'zod';
import { env } from '../env';

export const runDiscordAttachment = async (): Promise<void> => {
  const rpc = createNotify({ channels: { discord: discordChannel() } });

  const catalog = rpc.catalog({
    report: rpc
      .discord()
      .input(z.object({ title: z.string(), file: z.instanceof(Buffer) }))
      .body(({ input }) => `📎 **${input.title}**`)
      .embeds(({ input }) => [
        {
          title: input.title,
          description: 'See attached PDF for full details.',
          color: 0x5865f2,
          timestamp: new Date().toISOString(),
        },
      ])
      .attachments(({ input }) => [
        {
          filename: `${input.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          content: input.file,
          contentType: 'application/pdf',
        },
      ]),
  });

  const transport = discordTransport({
    webhookUrl: env.DISCORD_WEBHOOK_URL,
    wait: true,
    username: 'Report Bot',
  });

  const notify = createClient({
    catalog,
    channels: { discord: discordChannel() },
    transportsByChannel: { discord: transport },
  });

  const pdfPath = new URL('../test-utils/example-pdf.pdf', import.meta.url).pathname;
  const file = readFileSync(pdfPath);

  const result = await notify.report.send({
    input: { title: 'Example Report', file },
  });

  console.log('discord attachment:', { messageId: result.messageId, data: result.data });
  console.log('---');
};
