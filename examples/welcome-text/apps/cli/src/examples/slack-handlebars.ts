import Handlebars from 'handlebars';
import { createNotify, createClient } from '@betternotify/core';
import { slackChannel, slackTransport } from '@betternotify/slack';
import { z } from 'zod';
import { env } from '../env';

const textTemplate = Handlebars.compile(
  '🚨 *Incident: {{title}}*\nSeverity: {{severity}} | Service: {{service}}',
);

const rpc = createNotify({ channels: { slack: slackChannel() } });
const catalog = rpc.catalog({
  incident: rpc
    .slack()
    .input(
      z.object({
        title: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        service: z.string(),
        description: z.string(),
        runbookUrl: z.string().url(),
      }),
    )
    .text(({ input }) => textTemplate(input))
    .blocks(({ input }) => [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 ${input.title}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Severity:*\n${input.severity.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Service:*\n${input.service}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: input.description },
      },
      { type: 'divider', block_id: 'div' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `📖 Runbook: ${input.runbookUrl}` }],
      },
    ]),
});

export const runSlackHandlebars = async (): Promise<void> => {
  const transport = slackTransport({ token: env.SLACK_BOT_TOKEN });

  const notify = createClient({
    catalog,
    channels: { slack: slackChannel() },
    transportsByChannel: { slack: transport },
  });

  const result = await notify.incident.send({
    to: env.SLACK_CHANNEL,
    input: {
      title: 'Database connection pool exhausted',
      severity: 'critical',
      service: 'user-api',
      description:
        'Connection pool hit max (100/100). New queries are queuing. p99 latency spiked to 12s.',
      runbookUrl: 'https://wiki.example.com/runbooks/db-pool-exhausted',
    },
  });

  console.log('messageId:', result.messageId);
  console.log('— Slack notification text rendered with Handlebars, blocks built from typed input.');
};
