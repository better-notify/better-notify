# @betternotify/whatsapp

[![npm version](https://img.shields.io/npm/v/@betternotify/whatsapp)](https://www.npmjs.com/package/@betternotify/whatsapp)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/whatsapp)](https://www.npmjs.com/package/@betternotify/whatsapp)
[![license](https://img.shields.io/npm/l/@betternotify/whatsapp)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

[WhatsApp](https://www.whatsapp.com) channel for [Better-Notify](https://github.com/better-notify/better-notify). Sends text, media, location, interactive, contact, and reaction messages through a single channel with discriminated builder actions. Transport-agnostic — pair with `@betternotify/whatsapp-meta`, `@betternotify/whatsapp-baileys`, or any custom transport.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/whatsapp @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { whatsappChannel } from '@betternotify/whatsapp';
import { z } from 'zod';

const rpc = createNotify({ channels: { whatsapp: whatsappChannel() } });

const catalog = rpc.catalog({
  orderConfirm: rpc
    .whatsapp()
    .text()
    .input(z.object({ orderId: z.string(), total: z.string() }))
    .body(({ input }) => `Order ${input.orderId} confirmed! Total: ${input.total}`),

  receipt: rpc
    .whatsapp()
    .document()
    .input(z.object({ orderId: z.string(), url: z.string() }))
    .url(({ input }) => input.url)
    .filename(({ input }) => `receipt-${input.orderId}.pdf`),

  feedback: rpc
    .whatsapp()
    .interactive()
    .input(z.object({ orderId: z.string() }))
    .body(({ input }) => `How was order ${input.orderId}?`)
    .buttons([
      { id: 'great', title: 'Great!' },
      { id: 'ok', title: 'OK' },
      { id: 'bad', title: 'Not good' },
    ]),
});

const notify = createClient({
  catalog,
  transportsByChannel: { whatsapp: yourTransport },
});
```

### Sending

```ts
await notify.orderConfirm.send({
  to: '+5511999999999',
  input: { orderId: 'ORD-1234', total: 'R$ 199,90' },
});

await notify.receipt.send({
  to: '+5511999999999',
  input: { orderId: 'ORD-1234', url: 'https://cdn.example.com/receipts/ORD-1234.pdf' },
});

await notify.feedback.send({
  to: '+5511999999999',
  input: { orderId: 'ORD-1234' },
});
```

## Actions

`whatsappChannel()` exposes nine actions via the builder. Each narrows the available slots and send-time args.

### `.text()`

Sends a plain text message.

**Slots:** `body` (required)

### `.image()`

Sends an image with an optional caption.

**Slots:** `url` (required), `caption` (optional)

### `.video()`

Sends a video with an optional caption.

**Slots:** `url` (required), `caption` (optional)

### `.document()`

Sends a document with optional caption and filename.

**Slots:** `url` (required), `caption` (optional), `filename` (optional)

### `.audio()`

Sends an audio message.

**Slots:** `url` (required)

### `.location()`

Sends a location pin.

**Slots:** `latitude` (required), `longitude` (required), `name` (optional), `address` (optional)

### `.reaction()`

Reacts to an existing message with an emoji.

**Slots:** `emoji` (required)

**Send args:**

| Field       | Type     | Required | Description                   |
| ----------- | -------- | -------- | ----------------------------- |
| `messageId` | `string` | Yes      | ID of the message to react to |

### `.interactive()`

Sends an interactive message with buttons or list menus.

**Slots:** `body` (required), `header` (optional), `footer` (optional), `buttons` (optional), `sections` (optional)

### `.contacts()`

Shares one or more contact cards.

**Slots:** `contacts` (required)

## Send Args

All actions share a common base:

| Field   | Type     | Required | Description                                    |
| ------- | -------- | -------- | ---------------------------------------------- |
| `to`    | `string` | Yes      | Recipient identifier (phone number, LID, etc.) |
| `input` | `TInput` | Yes      | Validated input data                           |

The `to` field is an opaque string with no format validation — it can be an E.164 phone number, a WhatsApp LID, or a provider-specific identifier.

## Transports

This package defines the channel only. Pair it with a transport package:

| Package                          | Provider                  |
| -------------------------------- | ------------------------- |
| `@betternotify/whatsapp-meta`    | Meta Cloud API (official) |
| `@betternotify/whatsapp-baileys` | Baileys (unofficial)      |
| `@betternotify/whatsapp-bird`    | Bird (MessageBird)        |

For testing, use `createMockTransport` from `@betternotify/core/transports`:

```ts
import { createMockTransport } from '@betternotify/core/transports';
import type { RenderedWhatsApp } from '@betternotify/whatsapp';

const mock = createMockTransport<RenderedWhatsApp>({
  name: 'mock-whatsapp',
  reply: (rendered) => ({ messageId: `wamid.mock-${rendered.action}` }),
});
```

## Templates

WhatsApp Business templates (Meta-approved pre-registered messages) are a transport-level concern, not a channel action. When using `@betternotify/whatsapp-meta`, template configuration is passed through `TransportDataMap` per-send overrides. See the transport package documentation for details.

## License

MIT
