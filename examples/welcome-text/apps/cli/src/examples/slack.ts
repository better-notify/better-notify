import { createNotify, createClient } from '@betternotify/core';
import { slackChannel, slackTransport } from '@betternotify/slack';
import { z } from 'zod';
import { env } from '../env';

export const runSlack = async (): Promise<void> => {
  const rpc = createNotify({ channels: { slack: slackChannel() } });

  const catalog = rpc.catalog({
    deployAlert: rpc
      .slack()
      .input(
        z.object({
          service: z.enum(['api', 'web', 'worker']),
          version: z.string(),
          status: z.enum(['healthy', 'unhealthy']),
        }),
      )
      .text(({ input }) => `${input.service} deployed ${input.version} — ${input.status}`)
      .blocks(({ input }) => [
        { type: 'header', text: { type: 'plain_text', text: `:rocket: Deploy: ${input.service}` } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Version *${input.version}* is now live.\nStatus: \`${input.status}\``,
          },
        },
        {
          type: 'divider',
          block_id: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Deployed by ${input.version} on ${new Date().toISOString()}`,
            },
          ],
        },
      ]),
    incidentOpened: rpc
      .slack()
      .input(z.object({ summary: z.string(), severity: z.enum(['low', 'medium', 'high']) }))
      .text(({ input }) => `[${input.severity.toUpperCase()}] ${input.summary}`),
  });

  const transport = slackTransport({ token: env.SLACK_BOT_TOKEN });
  const notify = createClient({
    catalog,
    channels: { slack: slackChannel() },
    transportsByChannel: { slack: transport },
  });

  const deployResult = await notify.deployAlert.send({
    to: env.SLACK_CHANNEL,
    input: { service: 'api', version: 'v3.18.0', status: 'healthy' },
  });

  const deployTs = (deployResult.data as { ts?: string })?.ts;

  const incidentResult = await notify.incidentOpened.send({
    to: env.SLACK_CHANNEL,
    threadTs: deployTs,
    input: { severity: 'high', summary: 'p99 latency spiked over 2s' },
  });

  const batchResult = await notify.deployAlert.batch([
    { to: env.SLACK_CHANNEL, input: { service: 'web', version: 'v0.42.0', status: 'healthy' } },
    { to: env.SLACK_CHANNEL, input: { service: 'worker', version: 'v1.5.0', status: 'healthy' } },
  ]);

  console.log('deploy alert:', { messageId: deployResult.messageId, data: deployResult.data });
  console.log('incident (threaded):', {
    messageId: incidentResult.messageId,
    data: incidentResult.data,
  });
  console.log(`batch: ${batchResult.okCount} ok / ${batchResult.errorCount} errors`);

  console.log('---');
  console.log(
    'use slackTransport({ token }) for real Slack delivery — same Channel/Transport contract.',
  );
};
