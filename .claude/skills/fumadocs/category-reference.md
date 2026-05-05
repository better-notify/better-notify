# Reference Page Template

Template for reference pages that document API surface, types, and configuration options.

---

## Section 1: Opening line

**Heading level:** None — sits directly under the frontmatter.

**Content guidance:** Name the package and subpath export this reference covers.

**Fumadocs component:** None.

**Skeleton:**

```mdx
---
title: [Module Name]
icon: Code
description: [One-line summary for meta tags and search]
---

API reference for `@betternotify/core/subpath`.
```

---

## Section 2: Types

**Heading level:** `## Types`

**Content guidance:** One TypeTable per type. List every field. Use the actual type names from the source code. Group related types under `##` sub-headings.

**Fumadocs component:** `TypeTable` (import from `fumadocs-ui/components/type-table`).

**Skeleton:**

```mdx
## Types

import { TypeTable } from 'fumadocs-ui/components/type-table';

### TransportResult

<TypeTable
  type={{
    ok: {
      description: 'Whether the send succeeded.',
      type: 'boolean',
    },
    messageId: {
      description: 'Provider-assigned message identifier.',
      type: 'string | undefined',
    },
  }}
/>
```

---

## Section 3: Functions

**Heading level:** `## Functions`

**Content guidance:** Show the full generic signature. If there are overloads, show each one. Follow each signature with a TypeTable for its parameters and return type.

**Fumadocs component:** Fenced TypeScript code block for the signature, `TypeTable` for parameters and return type.

**Skeleton:**

````mdx
## Functions

### createSender

```ts
function createSender<TCatalog extends AnyCatalog>(
  options: SenderOptions<TCatalog>
): Sender<TCatalog>
```

<TypeTable
  type={{
    catalog: {
      description: 'The email catalog to bind.',
      type: 'TCatalog',
    },
    transport: {
      description: 'Transport used to deliver messages.',
      type: 'Transport',
    },
    defaults: {
      description: 'Default sender address and reply-to.',
      type: 'SenderDefaults',
      default: '{}',
    },
  }}
/>

**Returns:** `Sender<TCatalog>` — a typed sender with one method per catalog route.
````

---

## Section 4: Examples

**Heading level:** `## Examples`

**Content guidance:** Minimal, focused on demonstrating the function's return value or side effect. One short example per function with imports.

**Fumadocs component:** None — use a fenced TypeScript code block.

**Skeleton:**

````mdx
## Examples

### createSender

```ts
import { createSender } from '@betternotify/core/sender';
import { smtpTransport } from '@betternotify/smtp';
import { catalog } from './catalog';

const mail = createSender({
  catalog,
  transport: smtpTransport({ host: 'email-smtp.us-east-1.amazonaws.com', port: 587, auth: { user: process.env.SES_SMTP_USER!, pass: process.env.SES_SMTP_PASS! } }),
  defaults: { from: { name: 'Acme', email: 'noreply@acme.com' } },
});

const result = await mail.welcome.send({ userId: 'usr_123' });
```
````

---

## Section 5: Related

**Heading level:** `## Related`

**Content guidance:** Link to implementation pages that use these APIs in context. Use Cards so the reader can navigate to practical usage.

**Fumadocs component:** `Cards` and `Card` (auto-registered, no import needed).

**Skeleton:**

```mdx
## Related

<Cards>
  <Card href="../transports/generic/multi-transport.mdx" title="Multi-Transport">
    See multiTransport in action
  </Card>
</Cards>
```
