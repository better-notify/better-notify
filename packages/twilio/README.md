# @betternotify/twilio

Twilio SMS transport for [Better-Notify](https://github.com/better-notify/better-notify). Sends rendered SMS messages through the Twilio Messages API.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/twilio @betternotify/core @betternotify/sms
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { smsChannel } from '@betternotify/sms';
import { twilioSmsTransport } from '@betternotify/twilio';
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
  transportsByChannel: {
    sms: twilioSmsTransport({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      from: process.env.TWILIO_FROM_NUMBER!,
    }),
  },
});

await notify.loginCode.send({ to: '+15555555555', input: { code: '424242' } });
```

## Options

| Field        | Type     | Description                                             |
| ------------ | -------- | ------------------------------------------------------- |
| `accountSid` | `string` | Twilio Account SID. Required.                           |
| `authToken`  | `string` | Twilio Auth Token. Required.                            |
| `from`       | `string` | Sender phone number or messaging service SID. Required. |
| `http`       | `object` | HTTP behavior options (retry, timeout, hooks).          |

## License

MIT
