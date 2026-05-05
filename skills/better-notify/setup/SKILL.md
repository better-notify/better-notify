---
name: better-notify/setup
description: Interactive setup wizard for adding Better Notify to a TypeScript/JavaScript project
---

# Better Notify Setup

Guide for adding typed notifications to TypeScript/JavaScript applications using Better Notify.

**For code examples and syntax, see [better-notify.com/docs](https://better-notify.com/docs).**

---

## Phase 1: Planning (REQUIRED before implementation)

Scan the project and ask the user structured questions before writing any code.

### Step 1: Scan the project

Analyze the codebase to auto-detect:

- **Framework** — Look for `next.config`, `hono`, `express`, `fastify`, or other server entry files.
- **Existing notifications** — Look for `nodemailer`, `@sendgrid`, `resend`, `postmark`, `ses` in `package.json`.
- **Validation library** — Look for `zod`, `valibot`, `arktype` in `package.json` (Better Notify uses Standard Schema).
- **Package manager** — Check for `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, or `package-lock.json`.

Use what you find to pre-fill defaults and skip questions you can already answer.

### Step 2: Ask planning questions

Ask all applicable questions in a single call. Skip any you already answered from the scan.

1. **Notification channels** (always ask, allow multiple)
   - "Which notification channels do you need?"
   - Options: Email | SMS | Push notifications | Discord | Slack | Telegram | Custom channel

2. **Email transport** (only if Email selected)
   - "Which email transport will you use?"
   - Options: SMTP (Nodemailer) | Resend | Mailchimp Transactional (Mandrill) | Cloudflare Email | Mock (for development)

3. **SMS transport** (only if SMS selected)
   - "Which SMS transport will you use?"
   - Options: Twilio | Mock (for development)

4. **Template engine** (only if Email selected)
   - "How do you want to write email templates?"
   - Options: React Email | MJML | Handlebars | Inline HTML (no adapter needed)

5. **Validation library** (skip if detected)
   - "Which validation library do you use? Better Notify supports any Standard Schema provider."
   - Options: Zod | Valibot | ArkType

6. **Queue** (always ask)
   - "Do you need background queue processing?"
   - Options: Yes (BullMQ + Redis) | No (send synchronously)

7. **Features** (always ask, allow multiple)
   - "Which additional features do you need?"
   - Options: Rate limiting | Idempotency (deduplication) | Suppression list | Tracing | Event logging | Dry-run mode | None

### Step 3: Summarize the plan

Present a concise implementation plan as a markdown checklist. Example:

```
## Notification Setup Plan

- **Channels:** Email, Slack
- **Email transport:** SMTP
- **Templates:** React Email
- **Validation:** Zod
- **Queue:** No
- **Features:** Rate limiting, event logging

### Steps
1. Install `@betternotify/core`, `@betternotify/email`, `@betternotify/slack`
2. Install `@betternotify/smtp`, `@betternotify/react-email`
3. Create `lib/notify.ts` with channel config and catalog
4. Create `lib/notify-client.ts` with client setup
5. Create email templates under `emails/`
6. Add middleware (rate limiting, event logging)
7. Set up environment variables
```

Ask the user to confirm before proceeding to Phase 2.

---

## Phase 2: Implementation

Only proceed after the user confirms the plan.

### Step 1: Install packages

**Core (always):** `@betternotify/core`

**Channels:**
| Package | When |
|---------|------|
| `@betternotify/email` | Email channel |
| `@betternotify/sms` | SMS channel |
| `@betternotify/push` | Push notifications |
| `@betternotify/discord` | Discord webhooks |
| `@betternotify/slack` | Slack messages |
| `@betternotify/telegram` | Telegram bot |

**Transports:**
| Package | When |
|---------|------|
| `@betternotify/smtp` | SMTP email (Nodemailer) |
| `@betternotify/resend` | Resend email |
| `@betternotify/mailchimp` | Mailchimp Transactional |
| `@betternotify/cloudflare-email` | Cloudflare Email |
| `@betternotify/twilio` | Twilio SMS |

**Templates:**
| Package | When |
|---------|------|
| `@betternotify/react-email` | React Email templates |
| `@betternotify/mjml` | MJML templates |
| `@betternotify/handlebars` | Handlebars templates |

**Queue:**
| Package | When |
|---------|------|
| `@betternotify/bullmq` | Background processing |

### Step 2: Define the catalog (`lib/notify.ts`)

```typescript
import { createNotify } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { z } from 'zod';

export const ch = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});

const rpc = createNotify({ channels: { email: ch } });

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        html: `<p>Welcome, ${input.name}!</p>`,
        text: `Welcome, ${input.name}!`,
      }),
    }),
});
```

**Multi-channel example:**

```typescript
import { createNotify } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { slackChannel } from '@betternotify/slack';

const rpc = createNotify({
  channels: {
    email: emailChannel({ defaults: { from: 'noreply@example.com' } }),
    slack: slackChannel(),
  },
});

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({ render: async ({ input }) => ({ html: `...`, text: `...` }) }),

  alert: rpc
    .slack()
    .input(z.object({ message: z.string() }))
    .text(({ input }) => input.message),
});
```

**Sub-catalogs (nested routes):**

```typescript
export const catalog = rpc.catalog({
  transactional: rpc.catalog({
    welcome: rpc.email()...,
    reset: rpc.email()...,
  }),
  marketing: rpc.catalog({
    newsletter: rpc.email()...,
  }),
})
// Routes: transactional.welcome, transactional.reset, marketing.newsletter
```

### Step 3: Create the client (`lib/notify-client.ts`)

```typescript
import { createClient, consoleLogger } from '@betternotify/core';
import { smtpTransport } from '@betternotify/smtp';
import { catalog, ch } from './notify';

export const mail = createClient({
  catalog,
  channels: { email: ch },
  transportsByChannel: {
    email: smtpTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT),
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    }),
  },
  logger: consoleLogger({ level: 'info' }),
});
```

### Step 4: Send notifications

```typescript
import { mail } from './lib/notify-client';

const result = await mail.welcome.send({
  to: 'user@example.com',
  input: { name: 'Alice', verifyUrl: 'https://...' },
});

// Batch sending
const batch = await mail.welcome.batch(
  [
    { to: 'alice@example.com', input: { name: 'Alice', verifyUrl: '...' } },
    { to: 'bob@example.com', input: { name: 'Bob', verifyUrl: '...' } },
  ],
  { interval: 250 },
);
```

### Step 5: Environment variables

```env
# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass

# Resend (alternative)
RESEND_API_KEY=re_...

# Slack
SLACK_TOKEN=xoxb-...
SLACK_DEFAULT_CHANNEL=C0123456789

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Telegram
TELEGRAM_BOT_TOKEN=...
```

### Step 6: Add middleware (optional)

```typescript
import { withRateLimit, withEventLogger } from '@betternotify/core/middlewares';
import { inMemoryRateLimitStore } from '@betternotify/core/stores';
import { consoleEventSink } from '@betternotify/core/sinks';

const rpc = createNotify({ channels: { email: ch } })
  .use(
    withRateLimit({
      store: inMemoryRateLimitStore(),
      key: ({ args }) => args.to,
      max: 5,
      window: 60_000,
    }),
  )
  .use(withEventLogger({ sink: consoleEventSink() }));
```

### Step 7: Testing with mock transports

```typescript
import { mockTransport } from '@betternotify/email';

const mock = mockTransport();
const mail = createClient({
  catalog,
  channels: { email: ch },
  transportsByChannel: { email: mock },
});

await mail.welcome.send({ to: 'test@example.com', input: { name: 'Test' } });

assert(mock.sent.length === 1);
assert(mock.sent[0].subject === 'Welcome, Test!');
mock.reset();
```

---

## Template Adapters

### React Email

```typescript
import { reactEmail } from '@betternotify/react-email'
import { WelcomeEmail } from '../emails/welcome'

.template(({ input }) => reactEmail(WelcomeEmail, { name: input.name }))
```

### Handlebars

```typescript
import { handlebarsTemplate } from '@betternotify/handlebars'

.template(handlebarsTemplate('<h1>Hello {{name}}</h1>', {
  text: 'Hello {{name}}',
  subject: 'Welcome, {{name}}!',
}))
```

### MJML

```typescript
import { mjml } from '@betternotify/mjml'

.template(mjml(`<mjml><mj-body>...</mj-body></mjml>`))
```

---

## Transport Options

### Multi-transport (failover)

```typescript
import { multiTransport } from '@betternotify/email';

const transport = multiTransport({
  strategy: 'failover',
  transports: [{ transport: primaryTransport }, { transport: fallbackTransport }],
});
```

Strategies: `failover`, `round-robin`, `random`, `race`, `parallel`, `mirrored`.

---

## Resources

- [Docs](https://better-notify.com/docs)
- [GitHub](https://github.com/better-notify/better-notify)
- [Examples](https://github.com/better-notify/better-notify/tree/main/examples)
