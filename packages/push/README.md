# @emailrpc/push

Push notification channel for [emailRpc](../../README.md). Provides `pushChannel()`, a `mockPushTransport` for tests, and `multiTransport` / `createTransport` factories pre-parameterized for `RenderedPush`.

## Install

```sh
pnpm add @emailrpc/push @emailrpc/core
```

## Usage

```ts
import { createNotify, createClient } from '@emailrpc/core';
import { pushChannel, mockPushTransport } from '@emailrpc/push';
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
import { mockPushTransport, multiTransport, createTransport } from '@emailrpc/push';
```

Custom transport contract: `Transport<RenderedPush, PushTransportData>` where `PushTransportData = { messageId, provider? }`.

## License

MIT
