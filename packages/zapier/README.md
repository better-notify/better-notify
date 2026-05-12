# @betternotify/zapier

Zapier channel and email transport for [Better-Notify](https://github.com/better-notify/better-notify). Provides `zapierChannel()` for sending structured events to Zapier webhooks, plus `zapierTransport()` as an email transport that forwards rendered emails to Zapier for downstream processing.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/zapier @betternotify/core
```

## Usage (channel)

```ts
import { createNotify, createClient } from '@betternotify/core';
import { zapierChannel, mockZapierTransport } from '@betternotify/zapier';
import { z } from 'zod';

const zapier = zapierChannel();
const rpc = createNotify({ channels: { zapier } });

const catalog = rpc.catalog({
  newSignup: rpc
    .zapier()
    .input(z.object({ email: z.string(), plan: z.string() }))
    .event('user.signup')
    .data(({ input }) => ({ email: input.email, plan: input.plan })),
});

const notify = createClient({
  catalog,
  transportsByChannel: { zapier: mockZapierTransport() },
});

await notify.newSignup.send({
  to: 'https://hooks.zapier.com/hooks/catch/...',
  input: { email: 'user@example.com', plan: 'pro' },
});
```

## Builder slots

| Slot    | Required | Type                                                              |
| ------- | -------- | ----------------------------------------------------------------- |
| `event` | yes      | `string \| ({input}) => string`                                   |
| `data`  | no       | `Record<string, unknown> \| ({input}) => Record<string, unknown>` |
| `meta`  | no       | `Record<string, unknown> \| ({input}) => Record<string, unknown>` |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.newSignup.send({
  to: string, // Zapier webhook URL
  input: TInput,
});
```

## Usage (email transport)

`zapierTransport()` wraps a Zapier webhook as an email transport, forwarding rendered email payloads:

```ts
import { emailChannel } from '@betternotify/email';
import { zapierTransport } from '@betternotify/zapier';

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: zapierTransport({ webhookUrl: 'https://hooks.zapier.com/hooks/catch/...' }),
  },
});
```

## Transports

```ts
import { zapierChannelTransport, zapierTransport, mockZapierTransport } from '@betternotify/zapier';
```

- `mockZapierTransport()` — records sent messages for tests.
- `zapierChannelTransport()` — posts channel events to Zapier webhook URLs.
- `zapierTransport({ webhookUrl })` — email transport that forwards to a Zapier webhook.

## License

MIT
