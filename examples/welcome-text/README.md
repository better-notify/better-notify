# welcome-text

Minimal Node.js example that defines a typed welcome email contract using `@emailrpc/core`, validates input, renders a plain-text body, and prints the resulting message to stdout.

## Run

```sh
pnpm install            # at the repo root
pnpm --filter @example/welcome-text start
```

Expected output:

```
From:     hello@example.com
To:       lucas@example.com
Subject:  Welcome, Lucas!
---
Hi Lucas,

Thanks for signing up. Confirm your email address by visiting:
https://example.com/verify?token=abc123

If you didn't create this account, you can ignore this message.

— The Example Team
```

## What's happening

`src/emails.ts` defines the contract:

- A Zod schema for the input (`to`, `name`, `verifyUrl`).
- A subject that's computed from the validated input.
- A small `textTemplate(...)` adapter that satisfies `TemplateAdapter<TInput>` by returning `{ text, html }` from a function over the input.
- A router that registers the email under the `welcome` key.

`src/index.ts` runs the pipeline that the v0.2 sender will eventually run for you: validate input → resolve subject → render template → assemble the message.

## When v0.2 ships

The sender will let you replace the `send(...)` helper with:

```ts
import { createSender } from '@emailrpc/core/sender'
import { smtp } from '@emailrpc/core/provider'

const mail = createSender({
  router: emails,
  provider: smtp({ /* … */ }),
  defaults: { from: 'hello@example.com' },
})

await mail.welcome({
  to: 'lucas@example.com',
  name: 'Lucas',
  verifyUrl: 'https://example.com/verify?token=abc123',
})
```

The contract in `emails.ts` doesn't change.
