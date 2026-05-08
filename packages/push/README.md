# @betternotify/push

Push notification channel for [Better-Notify](https://github.com/better-notify/better-notify). Provides `pushChannel()`, a `mockPushTransport` for tests, and `multiTransport` / `createTransport` factories pre-parameterized for `RenderedPush`.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/push @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { pushChannel, mockPushTransport } from '@betternotify/push';
import { z } from 'zod';

const push = pushChannel();
const rpc = createNotify({ channels: { push } });

const catalog = rpc.catalog({
  newMessage: rpc
    .push()
    .input(z.object({ from: z.string(), preview: z.string() }))
    .title(({ input }) => `New message from ${input.from}`)
    .body(({ input }) => input.preview)
    .data(({ input }) => ({ deeplink: `/chats/${input.from}` })),
});

const notify = createClient({
  catalog,
  channels: { push },
  transportsByChannel: { push: mockPushTransport() },
});

await notify.newMessage.send({
  to: 'device-token-abc',
  input: { from: 'Alice', preview: 'See you tomorrow' },
});
```

## Builder slots

| Slot    | Required | Type                                                              |
| ------- | -------- | ----------------------------------------------------------------- |
| `title` | yes      | `string \| ({input}) => string`                                   |
| `body`  | yes      | `string \| ({input}) => string`                                   |
| `data`  | no       | `Record<string, unknown> \| ({input}) => Record<string, unknown>` |
| `badge` | no       | `number \| ({input}) => number`                                   |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.newMessage.send({
  to: string | ReadonlyArray<string>, // device token(s)
  input: TInput,
});
```

## Transports

```ts
import { mockPushTransport, multiTransport, createTransport } from '@betternotify/push';
```

Custom transport contract: `Transport<RenderedPush, PushTransportData>` where `PushTransportData = { messageId, provider? }`.

## License

MIT
