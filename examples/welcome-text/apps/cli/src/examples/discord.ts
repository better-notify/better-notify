import { createNotify, createClient } from '@betternotify/core';
import { discordChannel, discordTransport } from '@betternotify/discord';
import { z } from 'zod';
import { env } from '../env';

export const runDiscord = async (): Promise<void> => {
  const rpc = createNotify({ channels: { discord: discordChannel() } });

  const catalog = rpc.catalog({
    deployAlert: rpc
      .discord()
      .input(
        z.object({
          service: z.enum(['api', 'web']),
          version: z.string(),
          status: z.enum(['healthy', 'unhealthy']),
        }),
      )
      .body(({ input }) => `Deployed **${input.service}** v${input.version}`)
      .embeds(({ input }) => [
        {
          title: `${input.service} v${input.version}`,
          description: `Deployment ${input.status === 'healthy' ? 'succeeded' : 'failed'}`,
          color: input.status === 'healthy' ? 0x57f287 : 0xed4245,
          fields: [
            { name: 'Service', value: input.service, inline: true },
            { name: 'Version', value: input.version, inline: true },
            { name: 'Status', value: input.status, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'BetterNotify', icon_url: 'https://placehold.co/100x100.png' },
        },
      ])
      .username(({ input }) => (input.status === 'healthy' ? 'Deploy Bot' : 'Alert Bot')),
  });

  const transport = discordTransport({
    webhookUrl: env.DISCORD_WEBHOOK_URL,
    wait: true,
    username: 'BetterNotify',
  });

  const notify = createClient({
    catalog,
    channels: { discord: discordChannel() },
    transportsByChannel: { discord: transport },
  });

  const result = await notify.deployAlert.send({
    input: { service: 'api', version: '2.4.0', status: 'healthy' },
  });

  console.log('deploy alert:', { messageId: result.messageId, data: result.data });
  console.log('---');
};
