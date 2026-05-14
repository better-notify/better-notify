# @betternotify/slack

[![npm version](https://img.shields.io/npm/v/@betternotify/slack)](https://www.npmjs.com/package/@betternotify/slack)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/slack)](https://www.npmjs.com/package/@betternotify/slack)
[![license](https://img.shields.io/npm/l/@betternotify/slack)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

Slack channel for [Better-Notify](https://github.com/better-notify/better-notify). Provides `slackChannel()`, a `mockSlackTransport` for tests, and a `slackTransport` that posts to Slack via incoming webhooks or the Web API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/slack @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { slackChannel, mockSlackTransport } from '@betternotify/slack';
import { z } from 'zod';

const slack = slackChannel();
const rpc = createNotify({ channels: { slack } });

const catalog = rpc.catalog({
  deployAlert: rpc
    .slack()
    .input(z.object({ service: z.string(), version: z.string() }))
    .text(({ input }) => `*${input.service}* deployed v${input.version}`)
    .blocks(({ input }) => [
      { type: 'header', text: { type: 'plain_text', text: 'Deployment' } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Service:* ${input.service}` },
          { type: 'mrkdwn', text: `*Version:* ${input.version}` },
        ],
      },
    ]),
});

const notify = createClient({
  catalog,
  transportsByChannel: { slack: mockSlackTransport() },
});

await notify.deployAlert.send({
  to: 'https://hooks.slack.com/services/...',
  input: { service: 'api', version: '2.1.0' },
});
```

## Builder slots

| Slot     | Required | Type                                        |
| -------- | -------- | ------------------------------------------- |
| `text`   | yes      | `string \| ({input}) => string`             |
| `blocks` | no       | `SlackBlock[] \| ({input}) => SlackBlock[]` |
| `file`   | no       | `SlackFile \| ({input}) => SlackFile`       |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.deployAlert.send({
  to: string, // Slack webhook URL or channel ID
  input: TInput,
});
```

## Transports

```ts
import { slackTransport, mockSlackTransport } from '@betternotify/slack';

const transport = slackTransport({
  token: process.env.SLACK_BOT_TOKEN!,
});
```

- `mockSlackTransport()` — records sent messages for tests.
- `slackTransport({ token })` — sends via Slack Web API / incoming webhooks.

Custom transport contract: `Transport<RenderedSlack, SlackTransportData>`.

## License

MIT
