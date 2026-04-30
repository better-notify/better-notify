---
name: fumadocs
description: Use when writing MDX documentation pages for a Fumadocs project — frontmatter, meta.json, page ordering, and fumadocs-ui React components available inside MDX content.
---

# Fumadocs MDX Authoring

Reference for writing MDX documentation pages in a Fumadocs project and using fumadocs-ui components within them.

## Frontmatter

```yaml
---
title: My Page
description: Short description for meta and sidebar
icon: HomeIcon
full: false
---
```

| Field | Type | Purpose |
|-------|------|---------|
| `title` | `string` | Page title (required) |
| `description` | `string` | Meta description, sidebar subtitle |
| `icon` | `string` | Icon name from registered icons |
| `full` | `boolean` | Full-width mode, hides sidebar TOC |

## meta.json (folder config)

Place in any content folder to control title and page ordering.

```json
{
  "title": "Guides",
  "icon": "BookIcon",
  "root": true,
  "pages": [
    "setup",
    "---Getting Started---",
    "deploy",
    "...rest",
    "...folder",
    "!hidden-page"
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

## Components Available in MDX

### Callout

```mdx
<Callout>Default info message</Callout>
<Callout title="Warning" type="warn">Warning message</Callout>
<Callout title="Error" type="error">Error message</Callout>
```

| Prop | Type | Default |
|------|------|---------|
| `title` | `string` | — |
| `type` | `'info' \| 'warn' \| 'error'` | `'info'` |

### Cards / Card

```mdx
<Cards>
  <Card href="/docs/start" title="Getting Started">
    Description text
  </Card>
  <Card icon={<HomeIcon />} href="/" title="Home">
    With icon
  </Card>
  <Card title="No link">href is optional</Card>
</Cards>
```

| Prop | Type | Required |
|------|------|----------|
| `title` | `string` | yes |
| `href` | `string` | no |
| `icon` | `ReactNode` | no |
| children | description text | no |

### Tabs / Tab

Must be registered in `components/mdx.tsx` to use in MDX.

```tsx
// components/mdx.tsx — add these
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
```

```mdx
<Tabs items={['JavaScript', 'Python']}>
  <Tab value="JavaScript">JS content here</Tab>
  <Tab value="Python">Python content here</Tab>
</Tabs>
```

| Tabs Prop | Type | Purpose |
|-----------|------|---------|
| `items` | `string[]` | Tab labels |
| `defaultIndex` | `number` | Initial active tab |
| `groupId` | `string` | Sync selection across tab groups |
| `persist` | `boolean` | Save selection to localStorage |

### TypeTable

Must be imported in the MDX file.

```mdx
import { TypeTable } from 'fumadocs-ui/components/type-table';

<TypeTable
  type={{
    name: {
      description: 'The display name',
      type: 'string',
      default: 'World',
    },
    count: {
      description: 'Number of items',
      type: 'number',
    },
  }}
/>
```

Each field: `{ description: string, type: string, default?: any }`

### Steps / Step

```mdx
<Steps>
<Step>

### First Step

Content here

</Step>
<Step>

### Second Step

More content

</Step>
</Steps>
```

### Files / File / Folder

Must be imported in the MDX file.

```mdx
import { File, Folder, Files } from 'fumadocs-ui/components/files';

<Files>
  <Folder name="app" defaultOpen>
    <File name="layout.tsx" />
    <File name="page.tsx" />
  </Folder>
  <File name="package.json" />
</Files>
```

| Folder Prop | Type |
|-------------|------|
| `name` | `string` |
| `defaultOpen` | `boolean` |

### Banner

Must be imported in the MDX file.

```mdx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner>Announcement</Banner>
<Banner id="unique-id">Closeable (id enables close button)</Banner>
<Banner changeLayout={false}>Won't affect sidebar height</Banner>
```

| Prop | Type | Purpose |
|------|------|---------|
| `id` | `string` | Enables close button + persistence |
| `changeLayout` | `boolean` | Adjust layout height (default: true) |

### InlineTOC

```mdx
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';

<InlineTOC items={toc} />
```

### ImageZoom

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/screenshot.png" alt="Description" width={800} height={400} />
```

### Accordion / Accordions

```mdx
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';

<Accordions>
  <Accordion title="Question 1">Answer content</Accordion>
  <Accordion title="Question 2">More content</Accordion>
</Accordions>
```

## What's Auto-Registered vs Needs Import

**Auto-registered** (available in MDX without imports via `defaultMdxComponents`):
- `Callout`, `Cards`, `Card`, `Steps`, `Step`, headings, code blocks

**Needs registration in components/mdx.tsx** (then available without per-file imports):
- `Tab`, `Tabs`

**Needs per-file import**:
- `TypeTable` — `fumadocs-ui/components/type-table`
- `Files`, `File`, `Folder` — `fumadocs-ui/components/files`
- `Banner` — `fumadocs-ui/components/banner`
- `InlineTOC` — `fumadocs-ui/components/inline-toc`
- `ImageZoom` — `fumadocs-ui/components/image-zoom`
- `Accordion`, `Accordions` — `fumadocs-ui/components/accordion`

## Relative Links Between Pages

Use relative file paths — Fumadocs resolves them automatically:

```mdx
See [Getting Started](./getting-started.mdx) for setup instructions.
Check the [API Reference](../api/overview.mdx) for details.
```
