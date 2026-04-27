import {
  createNotify,
  createClient,
  createTransport,
  createMockTransport,
  defineChannel,
  slot,
  type Transport,
} from '@emailrpc/core';
import { z } from 'zod';

type RenderedSlack = {
  channel: string;
  text: string;
  threadTs?: string;
};

type SlackTransportData = { ts: string; channel: string };

const slackChannel = defineChannel({
  name: 'slack' as const,
  slots: { text: slot.resolver<string>() },
  validateArgs: z.object({
    channel: z.string(),
    threadTs: z.string().optional(),
  }),
  render: ({ runtime, args }): RenderedSlack => {
    const text =
      typeof runtime.text === 'function' ? runtime.text({ input: args.input }) : runtime.text;
    const rendered: RenderedSlack = { channel: args.channel, text };
    if (args.threadTs) rendered.threadTs = args.threadTs;
    return rendered;
  },
});

const httpSlackTransport = (token: string): Transport<RenderedSlack, SlackTransportData> =>
  createTransport<RenderedSlack, SlackTransportData>({
    name: 'slack-http',
    send: async (rendered) => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel: rendered.channel,
          text: rendered.text,
          thread_ts: rendered.threadTs,
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        ts?: string;
        channel?: string;
        error?: string;
      };
      if (!json.ok) {
        return { ok: false, error: new Error(`slack rejected: ${json.error ?? 'unknown'}`) };
      }
      return { ok: true, data: { ts: json.ts ?? '', channel: json.channel ?? rendered.channel } };
    },
  });

export const runCustomChannel = async (): Promise<void> => {
  const rpc = createNotify({ channels: { slack: slackChannel } });
  const catalog = rpc.catalog({
    deployFinished: rpc
      .slack()
      .input(z.object({ service: z.enum(['api-gateway', 'web']), version: z.string() }))
      .text(({ input }) => `:rocket: ${input.service} deployed: ${input.version}`),
    incidentOpened: rpc
      .slack()
      .input(z.object({ summary: z.string(), severity: z.enum(['low', 'medium', 'high']) }))
      .text(({ input }) => `:warning: [${input.severity.toUpperCase()}] ${input.summary}`),
  });

  const mock = createMockTransport<RenderedSlack, SlackTransportData>({
    name: 'mock-slack',
    reply: (rendered) => ({ ts: `${Date.now()}.000`, channel: rendered.channel }),
  });

  const notify = createClient({
    catalog,
    channels: { slack: slackChannel },
    transportsByChannel: { slack: mock },
  });

  const deploy = await notify.deployFinished.send({
    channel: '#deploys',
    input: { service: 'api-gateway', version: 'v3.18.0' },
  });
  console.log('deploy →', deploy.messageId, 'data:', deploy.data);

  const incident = await notify.incidentOpened.send({
    channel: '#incidents',
    threadTs: '1700000000.000100',
    input: { severity: 'high', summary: 'p99 latency spiked over 2s' },
  });
  console.log('incident →', incident.messageId, 'data:', incident.data);

  const batch = await notify.deployFinished.batch([
    { channel: '#deploys', input: { service: 'api-gateway', version: 'v3.18.1' } },
    { channel: '#deploys', input: { service: 'web', version: 'v0.42.0' } },
  ]);
  console.log(`batch: ${batch.okCount} ok / ${batch.errorCount} errors`);

  console.log('---');
  console.log(`captured ${mock.sent.length} sends:`);
  for (const { rendered } of mock.sent) {
    console.log(`  ${rendered.channel} → ${rendered.text}`);
  }

  console.log('---');
  console.log(
    'use httpSlackTransport(token) for real Slack delivery — same Channel/Transport contract.',
  );
  void httpSlackTransport;
};
