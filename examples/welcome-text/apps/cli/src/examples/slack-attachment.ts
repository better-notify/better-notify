import { createNotify, createClient } from '@betternotify/core';
import { slackChannel, slackTransport } from '@betternotify/slack';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

const pdfBuffer = await readFile(path.join(import.meta.dirname, '../test-utils/example-pdf.pdf'));

export const runSlackAttachment = async (): Promise<void> => {
  const rpc = createNotify({ channels: { slack: slackChannel() } });

  const catalog = rpc.catalog({
    imageReport: rpc
      .slack()
      .input(z.object({ title: z.string(), imageUrl: z.string(), altText: z.string() }))
      .text(({ input }) => input.title)
      .blocks(({ input }) => [
        { type: 'header', text: { type: 'plain_text', text: input.title } },
        {
          type: 'image',
          image_url: input.imageUrl,
          alt_text: input.altText,
        },
      ]),
    fileShare: rpc
      .slack()
      .input(
        z.object({
          filename: z.string(),
          downloadUrl: z.string(),
          sizeKb: z.number(),
          uploadedBy: z.string(),
        }),
      )
      .text(({ input }) => `${input.uploadedBy} shared ${input.filename}`)
      .blocks(({ input }) => [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:page_facing_up: *${input.filename}* (${input.sizeKb} KB)\nUploaded by ${input.uploadedBy}`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Download' },
            url: input.downloadUrl,
            action_id: 'download_file',
          },
        },
      ]),
    pdfReport: rpc
      .slack()
      .input(z.object({ title: z.string(), pdf: z.instanceof(Buffer) }))
      .text(({ input }) => `PDF attached: ${input.title}`)
      .file(({ input }) => ({
        data: input.pdf,
        filename: `${input.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        title: input.title,
      })),
    chartWithContext: rpc
      .slack()
      .input(
        z.object({
          metric: z.string(),
          chartUrl: z.string(),
          summary: z.string(),
          delta: z.string(),
        }),
      )
      .text(({ input }) => `${input.metric}: ${input.delta}`)
      .blocks(({ input }) => [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${input.metric}*\n${input.summary}\nChange: \`${input.delta}\``,
          },
        },
        {
          type: 'image',
          image_url: input.chartUrl,
          alt_text: `${input.metric} chart`,
        },
        { type: 'divider' },
      ]),
  });

  const transport = slackTransport({ token: env.SLACK_BOT_TOKEN });
  const notify = createClient({
    catalog,
    channels: { slack: slackChannel() },
    transportsByChannel: { slack: transport },
  });

  const imageResult = await notify.imageReport.send({
    to: env.SLACK_CHANNEL,
    input: {
      title: 'Weekly Metrics Dashboard',
      imageUrl: 'https://placehold.co/800x400.png',
      altText: 'Weekly metrics chart showing uptime and latency',
    },
  });

  const fileResult = await notify.fileShare.send({
    to: env.SLACK_CHANNEL,
    input: {
      filename: 'Q2-report.pdf',
      downloadUrl: 'https://example.com/files/q2-report.pdf',
      sizeKb: 2450,
      uploadedBy: 'Lucas',
    },
  });

  const pdfResult = await notify.pdfReport.send({
    to: env.SLACK_CHANNEL,
    input: { title: 'Q2 Financial Report', pdf: pdfBuffer },
  });

  const chartResult = await notify.chartWithContext.send({
    to: env.SLACK_CHANNEL,
    input: {
      metric: 'p99 Latency',
      chartUrl: 'https://placehold.co/600x300.png',
      summary: 'Latency dropped after the CDN migration completed.',
      delta: '-42ms (18%)',
    },
  });

  console.log('image report:', { messageId: imageResult.messageId, data: imageResult.data });
  console.log('file share:', { messageId: fileResult.messageId, data: fileResult.data });
  console.log('pdf report:', { messageId: pdfResult.messageId, data: pdfResult.data });
  console.log('chart with context:', { messageId: chartResult.messageId, data: chartResult.data });

  console.log('---');
};
