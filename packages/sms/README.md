# @betternotify/sms

SMS channel for [Better-Notify](../../README.md). Provides `smsChannel()`, a `mockSmsTransport` for tests, and `multiTransport` / `createTransport` factories pre-parameterized for `RenderedSms`.

## Install

```sh
pnpm add @betternotify/sms @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { smsChannel, mockSmsTransport } from '@betternotify/sms';
import { z } from 'zod';

const sms = smsChannel();
const rpc = createNotify({ channels: { sms } });

const catalog = rpc.catalog({
  loginCode: rpc
    .sms()
    .input(z.object({ code: z.string() }))
    .body(({ input }) => `Your login code is ${input.code}`),
});

const notify = createClient({
  catalog,
  channels: { sms },
  transportsByChannel: { sms: mockSmsTransport() },
});

await notify.loginCode.send({ to: '+15555555555', input: { code: '424242' } });
```

## Builder slots

| Slot   | Required | Type                            |
| ------ | -------- | ------------------------------- |
| `body` | yes      | `string \| ({input}) => string` |

Plus `.input(schema)` and `.use(mw)`.

## Send args

```ts
notify.loginCode.send({
  to: string,
  input: TInput,
});
```

## Transports

```ts
import { mockSmsTransport, multiTransport, createTransport } from '@betternotify/sms';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: createTransport({ name: 'twilio', send: async (rendered) => /* ... */ }) },
    { transport: createTransport({ name: 'vonage', send: async (rendered) => /* ... */ }) },
  ],
});
```

Custom transport contract: `Transport<RenderedSms, SmsTransportData>` where `SmsTransportData = { messageId, provider? }`. Return `{ ok: true, data }` on success or `{ ok: false, error }` on soft failure.

## License

MIT
