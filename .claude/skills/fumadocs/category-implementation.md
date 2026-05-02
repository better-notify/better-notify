# Implementation Page Template

Template for implementation pages that show how to use a specific feature, transport, middleware, or plugin.

Reference model: `apps/web/content/docs/transports/generic/multi-transport.mdx` follows this template. Study it for tone and depth.

## Section 1: Opening Line

**Heading level:** None. Sits directly under the frontmatter block.

**Content guidance:** One sentence starting with the function name in backticks. State what the function does and stop. No preamble, no "In this page you will learn..." filler.

**Component:** None.

**Skeleton:**

```mdx
---
title: Feature Name
icon: Plug
description: One-sentence summary for meta tags and sidebar.
---

`functionName()` does [what it does in one sentence].
```

## Section 2: Quick Example

**Heading level:** None. Immediately follows the opening line, separated by a blank line.

**Content guidance:** Minimal working code that a reader can copy-paste into a project and have it run. Include every import with real `@betternotify/*` paths. Use realistic values, never `foo`/`bar`/`example.com`. No explanation prose between the opening line and the code block -- the code speaks for itself.

**Component:** Fenced TypeScript code block.

**Skeleton:**

```mdx
`multiTransport()` composes multiple transports behind a single `Transport` interface.

```ts
import { multiTransport } from '@betternotify/core/transports';
import { sesTransport } from '@betternotify/ses';
import { resendTransport } from '@betternotify/resend';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: sesTransport({ region: 'us-east-1' }) },
    { transport: resendTransport({ apiKey: process.env.RESEND_API_KEY }) },
  ],
});
```
```

## Section 3: Behavior Overview

**Heading level:** `##`. Use `## Behavior` as the default, or a more specific heading that matches the feature (e.g., `## Strategies`, `## Modes`, `## Matching Rules`).

**Content guidance:** Describe what the feature does at runtime, not how it is implemented internally. Tables work well for comparing modes, strategies, or option combinations. Use `Tabs` when distinct usage patterns need side-by-side code. Break into `###` subsections when each variant warrants its own code example.

**Components:** Markdown tables for comparison. `Tabs`/`Tab` for distinct usage patterns. `###` subsections with code blocks for per-variant examples.

**Skeleton:**

```mdx
## Strategies

Strategies split into two families:

- **Sequential** -- tries transports one at a time, advancing on failure.
- **Parallel** -- fires multiple transports concurrently.

| Strategy | Family | Behavior |
|----------|--------|----------|
| `failover` | Sequential | Try in order, stop on first success |
| `round-robin` | Sequential | Rotate start index across calls |
| `race` | Parallel | All fire, first success wins |

### Failover

Every `send()` starts at `transports[0]` and walks forward on failure. Use when you have a clear primary provider and one or more backups.

```ts
import { multiTransport } from '@betternotify/core/transports';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: primaryProvider },
    { transport: fallbackProvider },
  ],
});
```

### Round-Robin

An in-process counter advances the start index on each `send()`, distributing load evenly across equivalent providers.

```ts
const transport = multiTransport({
  strategy: 'round-robin',
  transports: [
    { transport: accountA },
    { transport: accountB },
    { transport: accountC },
  ],
});
```
```

## Section 4: Options

**Heading level:** `## Options`

**Content guidance:** Every config field gets a row in `TypeTable`. The description should answer "what happens if I change this?" -- not just restate the field name. Instead of "the name of the transport", write "identifier surfaced as the composite Transport.name; override when registering multiple composites." Include `default` values where they exist. Group related options into separate `TypeTable` blocks with a brief intro sentence when the option set is large enough to warrant it.

**Component:** `TypeTable` (requires import from `fumadocs-ui/components/type-table`).

**Skeleton:**

```mdx
import { TypeTable } from 'fumadocs-ui/components/type-table';

## Options

<TypeTable
  type={{
    name: {
      description: 'Identifier surfaced as the composite Transport.name. Override when registering multiple composites in the same client.',
      type: 'string',
      default: "'multi'",
    },
    strategy: {
      description: 'Dispatch strategy for inner transports. Determines whether sends are sequential or parallel and how the starting transport is chosen.',
      type: "MultiTransportStrategy",
    },
    transports: {
      description: 'Inner transports in priority order. Must be non-empty. Order matters for failover (first = primary) and round-robin rotation.',
      type: 'MultiTransportEntry[]',
    },
    logger: {
      description: 'Logger for orchestration events. Child-binds { component, name }.',
      type: 'LoggerLike',
    },
  }}
/>
```

## Section 5: Advanced Usage

**Heading level:** `## Advanced Usage`, or a topic-specific heading when the content covers a single advanced area (e.g., `## Retries and Backoff`, `## Composition with Middleware`).

**Content guidance:** Show composition with middleware, error handling, or non-obvious configurations. Use `Callout type="warn"` for things that would bite someone in production. Each advanced example should stand on its own -- include imports and enough context to copy-paste.

**Components:** Fenced TypeScript code blocks. `Callout` for production gotchas.

**Skeleton:**

```mdx
## Retries and Backoff

Sequential strategies support per-transport retries with exponential backoff. Parallel strategies ignore these options.

```ts
import { multiTransport } from '@betternotify/core/transports';

const transport = multiTransport({
  strategy: 'failover',
  transports: [
    { transport: primaryProvider },
    { transport: fallbackProvider },
  ],
  maxAttemptsPerTransport: 3,
  backoff: {
    initialMs: 100,
    factor: 2,
    maxMs: 5_000,
  },
  isRetriable: (err) => !(err instanceof RateLimitError),
});
```

<Callout type="warn">
  Backoff delays block the `send()` call. Keep `maxMs` low in latency-sensitive paths, or offload to a queue and let the worker retry.
</Callout>
```

## Section 6: Related

**Heading level:** `## Related`

**Content guidance:** Link to pages the reader would likely need next. Use `Cards` with 2-4 entries. Each card gets a one-line description of what the linked page covers. Prefer links to pages that complement this feature -- transports a middleware composes with, the guide that uses this feature end-to-end, or the reference page for the underlying types.

**Component:** `Cards`/`Card` (auto-registered, no import needed).

**Skeleton:**

```mdx
## Related

<Cards>
  <Card href="/docs/transports/custom-transports" title="Custom Transports">
    Build your own transport from the Transport interface.
  </Card>
  <Card href="/docs/transports/third-party/ses" title="Amazon SES">
    Send production email through AWS SES.
  </Card>
  <Card href="/docs/transports/generic/mock" title="Mock Transport">
    Capture sent messages in tests without hitting a real provider.
  </Card>
</Cards>
```
