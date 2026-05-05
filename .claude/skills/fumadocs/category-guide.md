# Guide Page Template

Template for guide pages that walk the reader through a multi-step workflow end-to-end.

## 1. Goal Statement

**Heading level:** None. Sits directly under the frontmatter block.

**Content guidance:** Write one concrete, measurable sentence that tells the reader exactly what they will have built or accomplished by the end of the page. Avoid vague learning objectives. The reader should be able to look at their running code and confirm they hit the goal.

- Good: "Send a transactional welcome email with SES failover."
- Bad: "Learn about transports."

**Component:** None.

```mdx
---
title: Send Email with SES Failover
icon: PaperPlane
description: Walk through sending a transactional email with automatic SES-to-SMTP failover.
---

By the end of this guide, you will send a transactional welcome email through SES with automatic SMTP failover when SES is unavailable.
```

## 2. Prerequisites

**Heading level:** `## Prerequisites`

**Content guidance:** List exact package names and versions the reader needs installed before starting. Include any external accounts or credentials required. One item per bullet. Keep it scannable.

**Component:** `Callout type="info"`

```mdx
## Prerequisites

<Callout title="Before you start" type="info">
- `@betternotify/core` installed
- `@betternotify/smtp` installed
- An AWS account with SES SMTP credentials
- SMTP credentials for your fallback server
</Callout>
```

## 3. Steps

**Heading level:** `## Steps`, with each step using a `###` heading inside a `Step` component.

**Content guidance:** Each step should be independently understandable. Explain *why* before showing *how*. The code in each step should build on the previous step. Include import statements in every code block where a new module appears. Keep each step focused on a single action.

**Component:** `Steps` / `Step`

```mdx
## Steps

<Steps>
<Step>

### Define the email route

The email route declares the input schema and template for your welcome email. Defining it first gives you type safety across the transport and sender layers.

```ts
import { createBetterNotify } from '@betternotify/core'
import { z } from 'zod'

const rpc = createBetterNotify<{ userId: string }>()

const welcome = rpc.email()
  .input(z.object({ name: z.string(), activationUrl: z.string().url() }))
  .subject(({ input }) => `Welcome, ${input.name}`)
  .template(welcomeTemplate)
```

</Step>
<Step>

### Configure the failover transport

A failover transport tries each transport in order. SES SMTP handles production traffic; a secondary relay catches anything SES rejects or drops.

```ts
import { multiTransport } from '@betternotify/core/transports'
import { smtpTransport } from '@betternotify/smtp'

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: smtpTransport({ host: 'email-smtp.us-east-1.amazonaws.com', port: 587, auth: { user: process.env.SES_SMTP_USER!, pass: process.env.SES_SMTP_PASS! } }) },
    { transport: smtpTransport({ host: 'smtp.mailrelay.net', port: 587, auth: { user: 'relay', pass: process.env.SMTP_PASS! } }) },
  ],
})
```

</Step>
<Step>

### Create the sender and send

The sender wires the catalog to the transport. Calling `mail.welcome.send()` validates input, renders the template, and delivers through the failover chain.

```ts
import { createSender } from '@betternotify/core/sender'

const catalog = rpc.catalog({ welcome })

const mail = createSender({
  catalog,
  transport,
  defaults: { from: { name: 'Acme', email: 'hello@acme.com' } },
})

await mail.welcome.send({
  to: 'ada@lovelace.dev',
  input: { name: 'Ada', activationUrl: 'https://acme.com/activate/abc123' },
})
```

</Step>
</Steps>
```

## 4. Final Result

**Heading level:** `## Final Result`

**Content guidance:** Show the complete assembled code in a single block so the reader can compare it against their own work. This block should be copy-pasteable and runnable with no edits beyond filling in credentials.

**Component:** None. Use a fenced `ts` code block.

```mdx
## Final Result

```ts
import { createBetterNotify } from '@betternotify/core'
import { createSender } from '@betternotify/core/sender'
import { multiTransport } from '@betternotify/core/transports'
import { smtpTransport } from '@betternotify/smtp'
import { z } from 'zod'

const rpc = createBetterNotify<{ userId: string }>()

const welcome = rpc.email()
  .input(z.object({ name: z.string(), activationUrl: z.string().url() }))
  .subject(({ input }) => `Welcome, ${input.name}`)
  .template(welcomeTemplate)

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: smtpTransport({ host: 'email-smtp.us-east-1.amazonaws.com', port: 587, auth: { user: process.env.SES_SMTP_USER!, pass: process.env.SES_SMTP_PASS! } }) },
    { transport: smtpTransport({ host: 'smtp.mailrelay.net', port: 587, auth: { user: 'relay', pass: process.env.SMTP_PASS! } }) },
  ],
})

const catalog = rpc.catalog({ welcome })

const mail = createSender({
  catalog,
  transport,
  defaults: { from: { name: 'Acme', email: 'hello@acme.com' } },
})

await mail.welcome.send({
  to: 'ada@lovelace.dev',
  input: { name: 'Ada', activationUrl: 'https://acme.com/activate/abc123' },
})
```
```

## 5. Next Steps

**Heading level:** `## Next Steps`

**Content guidance:** Link to 2-4 pages that deepen or extend what the reader built. Each card gets a short sentence describing what the reader gains by following that link. Pick pages that are natural continuations, not tangential topics.

**Component:** `Cards` / `Card`

```mdx
## Next Steps

<Cards>
  <Card href="/docs/transports/generic/multi-transport" title="Multi-Transport Strategies">
    Explore round-robin, broadcast, and conditional routing beyond failover.
  </Card>
  <Card href="/docs/transports/third-party/ses" title="SES Configuration">
    Fine-tune SES regions, identity verification, and sending limits.
  </Card>
  <Card href="/docs/guides/queue-delayed-sends" title="Queue and Delay Sends">
    Offload email delivery to a background worker with BullMQ.
  </Card>
</Cards>
```
