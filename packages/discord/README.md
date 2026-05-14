# @betternotify/discord

[![npm version](https://img.shields.io/npm/v/@betternotify/discord)](https://www.npmjs.com/package/@betternotify/discord)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/discord)](https://www.npmjs.com/package/@betternotify/discord)
[![license](https://img.shields.io/npm/l/@betternotify/discord)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

Discord channel for [Better-Notify](https://github.com/better-notify/better-notify). Provides `discordChannel()`, a `mockDiscordTransport` for tests, and a `discordTransport` that posts to Discord webhooks.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/discord @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { discordChannel, mockDiscordTransport } from '@betternotify/discord';
import { z } from 'zod';

const discord = discordChannel();
const rpc = createNotify({ channels: { discord } });

const catalog = rpc.catalog({
  deployAlert: rpc
    .discord()
    .input(z.object({ service: z.string(), version: z.string() }))
    .body(({ input }) => `**${input.service}** deployed v${input.version}`)
    .embeds(({ input }) => [
      {
        title: 'Deployment',
        fields: [
          { name: 'Service', value: input.service, inline: true },
          { name: 'Version', value: input.version, inline: true },
        ],
      },
    ]),
});

const notify = createClient({
  catalog,
  transportsByChannel: { discord: mockDiscordTransport() },
});

await notify.deployAlert.send({
  to: 'https://discord.com/api/webhooks/...',
  input: { service: 'api', version: '2.1.0' },
});
```

## Builder slots

| Slot     | Required | Type                                            |
| -------- | -------- | ----------------------------------------------- |
| `body`   | yes      | `string \| ({input}) => string`                 |
| `embeds` | no       | `DiscordEmbed[] \| ({input}) => DiscordEmbed[]` |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.deployAlert.send({
  to: string, // Discord webhook URL
  input: TInput,
});
```

## Transports

```ts
import { discordTransport, mockDiscordTransport } from '@betternotify/discord';
```

- `mockDiscordTransport()` — records sent messages for tests.
- `discordTransport()` — posts to Discord webhook URLs via `fetch`.

Custom transport contract: `Transport<RenderedDiscord, DiscordTransportData>`.

## License

MIT
