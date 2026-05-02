---
name: fumadocs
description: Use when writing MDX documentation pages for a Fumadocs project — frontmatter, meta.json, page ordering, and fumadocs-ui React components available inside MDX content.
---

# Fumadocs Documentation Template

This skill is the single source of truth for writing Better-Notify documentation pages. It covers structure, content, voice, component usage, and page ordering for all doc types.

## Frontmatter

Every MDX page requires three fields:

- `title` (required) — page heading, concise noun or verb phrase
- `icon` (required) — must be a key from the registered icon map below
- `description` (required) — one sentence, used in meta tags and sidebar

```yaml
---
title: Multi-Transport
icon: Truck
description: Compose multiple transports with routing, failover, and broadcast strategies.
---
```

Available icon keys:

```
Activity, AmazonLogo, Anchor, ArrowsLeftRight, At, Atom, Bell, BookOpen, Books, Bug,
ChatText, Code, Crosshair, CurlyBraces, Database, Envelope, Export, Eye, FileCode,
FileText, Fingerprint, FlaskRound, Funnel, Gauge, GitFork, Globe, History, House,
Layers, Layout, Lightbulb, Lightning, Megaphone, Newspaper, Notebook, Package,
PaperPlane, Path, Plug, Queue, Radio, Rocket, Scales, Server, Shield, Tag, Terminal,
TestTube, TreeStructure, Truck, Warning, Webhooks, Wrench
```

## Voice and Tone

1. Direct, second-person, present tense ("Use this when...", not "This can be used when...").
2. No filler: never "simply", "just", "easily", "basically".
3. No marketing: never "powerful", "seamless", "elegant".
4. Present tense for behavior ("Throws when all fail", not "Will throw when all fail").
5. Active voice over passive ("multiTransport composes..." not "transports are composed by...").

## Code Examples

1. Always include import statements with real `@betternotify/*` paths.
2. Realistic values, never `foo`/`bar`/`example.com` placeholders.
3. Minimal working example first, advanced variations after.
4. TypeScript only.

## Component Decision Guide

| Content type | Component | Import needed? |
|---|---|---|
| Comparing options or listing properties | `TypeTable` | Yes: `fumadocs-ui/components/type-table` |
| Step-by-step setup | `Steps/Step` | No (auto-registered) |
| Important warnings or caveats | `Callout` | No (auto-registered) |
| Alternative approaches or variants | `Tabs/Tab` | No (registered in mdx.tsx) |
| Linking to related pages | `Cards/Card` | No (auto-registered) |
| Showing file structure | `Files/File/Folder` | Yes: `fumadocs-ui/components/files` |
| Zoomable images | `ImageZoom` | Yes: `fumadocs-ui/components/image-zoom` |
| FAQ or collapsible content | `Accordion/Accordions` | Yes: `fumadocs-ui/components/accordion` |

## Component API Reference

### Callout

| Prop | Type | Default |
|------|------|---------|
| `title` | `string` | — |
| `type` | `'info' \| 'warn' \| 'error'` | `'info'` |

```mdx
<Callout>Default info callout with no title.</Callout>

<Callout title="Heads up" type="warn">
  This transport requires valid SMTP credentials at runtime.
</Callout>

<Callout title="Breaking change" type="error">
  The `provider` option was removed in v0.3. Use `transport` instead.
</Callout>
```

### Cards / Card

| Prop | Type | Required |
|------|------|----------|
| `title` | `string` | yes |
| `href` | `string` | no |
| `icon` | `ReactNode` | no |

```mdx
<Cards>
  <Card href="/docs/transports/generic/multi-transport" title="Multi-Transport">
    Compose multiple transports with routing and failover.
  </Card>
  <Card href="/docs/transports/third-party/ses" title="Amazon SES">
    Send production email through AWS SES.
  </Card>
</Cards>
```

### Tabs / Tab

| Tabs Prop | Type | Purpose |
|-----------|------|---------|
| `items` | `string[]` | Tab labels |
| `defaultIndex` | `number` | Initial active tab |
| `groupId` | `string` | Sync selection across tab groups |
| `persist` | `boolean` | Save selection to localStorage |

```mdx
<Tabs items={['SES', 'Resend', 'SMTP']}>
  <Tab value="SES">Configure with `sesTransport({ region: 'us-east-1' })`.</Tab>
  <Tab value="Resend">Configure with `resendTransport({ apiKey })`.</Tab>
  <Tab value="SMTP">Configure with `smtpTransport({ host, port, auth })`.</Tab>
</Tabs>
```

### TypeTable

Each field shape: `{ description: string, type: string, default?: any }`.

```mdx
import { TypeTable } from 'fumadocs-ui/components/type-table';

<TypeTable
  type={{
    strategy: {
      description: 'Routing strategy for outbound email.',
      type: "'failover' | 'round-robin' | 'broadcast' | 'random'",
      default: "'failover'",
    },
    transports: {
      description: 'Array of transport entries to compose.',
      type: 'TransportEntry[]',
    },
  }}
/>
```

### Steps / Step

```mdx
<Steps>
<Step>

### Install the package

```bash
pnpm add @betternotify/ses
```

</Step>
<Step>

### Configure the transport

```ts
import { sesTransport } from '@betternotify/ses'

const transport = sesTransport({ region: 'us-east-1' })
```

</Step>
</Steps>
```

### Files / File / Folder

| Folder Prop | Type |
|-------------|------|
| `name` | `string` |
| `defaultOpen` | `boolean` |

```mdx
import { File, Folder, Files } from 'fumadocs-ui/components/files';

<Files>
  <Folder name="packages" defaultOpen>
    <Folder name="core" defaultOpen>
      <File name="src/transports/multi.ts" />
      <File name="src/transports/types.ts" />
    </Folder>
    <Folder name="ses">
      <File name="src/index.ts" />
    </Folder>
  </Folder>
</Files>
```

### ImageZoom

| Prop | Type |
|------|------|
| `src` | `string` |
| `alt` | `string` |
| `width` | `number` |
| `height` | `number` |

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/docs/failover-diagram.png" alt="Failover strategy flow" width={720} height={400} />
```

### Accordion / Accordions

```mdx
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';

<Accordions>
  <Accordion title="When should I use broadcast?">
    Use broadcast when every transport must receive the message, such as sending through both a
    transactional provider and an analytics sink.
  </Accordion>
  <Accordion title="Does failover retry automatically?">
    Failover tries each transport in order. It does not retry a failed transport — it moves to
    the next one in the list.
  </Accordion>
</Accordions>
```

### Banner

| Prop | Type | Purpose |
|------|------|---------|
| `id` | `string` | Enables close button and persistence |
| `changeLayout` | `boolean` | Adjust layout height (default: true) |

```mdx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner>Better-Notify v0.2 is now available.</Banner>
<Banner id="v02-release">Closeable banner with persistence.</Banner>
<Banner changeLayout={false}>Does not shift sidebar height.</Banner>
```

### InlineTOC

```mdx
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';

<InlineTOC items={toc} />
```

## meta.json

Controls page ordering and folder behavior. Place one in each content directory.

```json
{
  "title": "Transports",
  "pages": [
    "custom-transports",
    "---Generic---",
    "multi-transport",
    "mock",
    "smtp",
    "...rest"
  ]
}
```

| Syntax | Meaning |
|--------|---------|
| `"page-name"` | Include page by filename (no extension) |
| `"---Text---"` | Separator with label |
| `"..."` | Rest — all unlisted pages |
| `"...folder"` | Extract folder children inline |
| `"!name"` | Exclude a page |
| `"root": true` | Makes folder a sidebar tab root |

When adding a new page, update the parent directory's `meta.json` to include it in the `pages` array.

## Links

Use absolute paths for cross-section links and relative paths within the same section:

```mdx
See [Middleware](/docs/concepts/middleware) for composition order.
See [Multi-Transport](./generic/multi-transport.mdx) for composed delivery.
```

## Third-party integrations

When documenting a page that integrates with an external library (React Email, Zod, OpenTelemetry, etc.), add a Card near the top linking to the library's official website or documentation. This gives readers quick access to the upstream reference without leaving the docs:

```mdx
<Cards>
  <Card href="https://react.email" title="React Email">
    Official documentation, component reference, and examples.
  </Card>
</Cards>
```

Follow this pattern for every third-party integration page — template adapters, transport providers, validator libraries, tracing tools, etc.

## Page Categories

Before writing, determine which category your page falls into and read the corresponding template:

- Explaining *what something is and why it exists*? Read `category-concept.md`.
- Showing *how to use a specific feature/transport/middleware/plugin*? Read `category-implementation.md`.
- Walking through *a multi-step workflow end-to-end*? Read `category-guide.md`.
- Documenting *API surface, types, or configuration options*? Read `category-reference.md`.

## Reference Model

`apps/web/content/docs/transports/generic/multi-transport.mdx` is the living example of a well-written implementation page. Study it for tone, structure depth, and component usage.
