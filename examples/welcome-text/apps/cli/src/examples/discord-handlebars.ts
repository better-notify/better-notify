import Handlebars from 'handlebars';
import { createNotify, createClient } from '@betternotify/core';
import { discordChannel, discordTransport } from '@betternotify/discord';
import { z } from 'zod';
import { env } from '../env';

const bodyTemplate = Handlebars.compile(
  '🚀 Deployed **{{service}}** `v{{version}}` — {{#if (eq status "healthy")}}✅ healthy{{else}}❌ unhealthy{{/if}}',
);

const embedDescTemplate = Handlebars.compile(
  'Service `{{service}}` was deployed to {{environment}}.\n\n{{#each changes}}- {{this}}\n{{/each}}',
);

Handlebars.registerHelper('eq', (a: string, b: string) => a === b);

const rpc = createNotify({ channels: { discord: discordChannel() } });
const catalog = rpc.catalog({
  deployAlert: rpc
    .discord()
    .input(
      z.object({
        service: z.string(),
        version: z.string(),
        status: z.enum(['healthy', 'unhealthy']),
        environment: z.string(),
        changes: z.array(z.string()),
      }),
    )
    .body(({ input }) => bodyTemplate(input))
    .embeds(({ input }) => [
      {
        title: `${input.service} v${input.version}`,
        description: embedDescTemplate(input),
        color: input.status === 'healthy' ? 0x57f287 : 0xed4245,
        fields: [
          { name: 'Environment', value: input.environment, inline: true },
          { name: 'Status', value: input.status, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ])
    .username(({ input }) => (input.status === 'healthy' ? 'Deploy Bot' : 'Alert Bot')),
});

export const runDiscordHandlebars = async (): Promise<void> => {
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
    input: {
      service: 'api',
      version: '2.4.0',
      status: 'healthy',
      environment: 'production',
      changes: ['Fixed auth timeout', 'Added rate limiting', 'Updated deps'],
    },
  });

  console.log('messageId:', result.messageId);
  console.log('— Discord body and embeds rendered with Handlebars templates.');
};
