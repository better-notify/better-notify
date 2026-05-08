# @betternotify/telegram

Telegram channel for [Better-Notify](https://github.com/better-notify/better-notify). Provides `telegramChannel()`, a `mockTelegramTransport` for tests, a `telegramTransport` that sends via the Telegram Bot API, and markdown escape utilities.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/telegram @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { telegramChannel, mockTelegramTransport } from '@betternotify/telegram';
import { z } from 'zod';

const telegram = telegramChannel();
const rpc = createNotify({ channels: { telegram } });

const catalog = rpc.catalog({
  orderShipped: rpc
    .telegram()
    .input(z.object({ orderId: z.string(), trackingUrl: z.string().url() }))
    .body(({ input }) => `Order ${input.orderId} shipped! Track: ${input.trackingUrl}`),
});

const notify = createClient({
  catalog,
  channels: { telegram },
  transportsByChannel: { telegram: mockTelegramTransport() },
});

await notify.orderShipped.send({
  to: '123456789', // Telegram chat ID
  input: { orderId: 'ORD-42', trackingUrl: 'https://track.example.com/ORD-42' },
});
```

## Builder slots

| Slot          | Required | Type                                                     |
| ------------- | -------- | -------------------------------------------------------- |
| `body`        | yes      | `string \| ({input}) => string`                          |
| `attachments` | no       | `TelegramAttachment[] \| ({input}) => TelegramAttachment[]` |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.orderShipped.send({
  to: string | number, // Telegram chat ID
  input: TInput,
});
```

## Markdown utilities

```ts
import { escapeMarkdownV2, md } from '@betternotify/telegram';

const safe = escapeMarkdownV2('Price: $10.00 (50% off!)');
const bold = md.bold('important');
```

`escapeMarkdownV2` escapes all Telegram MarkdownV2 special characters. The `md` helper provides `bold`, `italic`, `code`, `pre`, `link`, and other formatters that handle escaping automatically.

## Transports

```ts
import {
  telegramTransport,
  mockTelegramTransport,
} from '@betternotify/telegram';

const transport = telegramTransport({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
```

- `mockTelegramTransport()` — records sent messages for tests.
- `telegramTransport({ botToken })` — sends via the Telegram Bot API.

Custom transport contract: `Transport<RenderedTelegram, TelegramTransportData>`.

## License

MIT
