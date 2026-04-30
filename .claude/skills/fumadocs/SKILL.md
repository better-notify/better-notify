---
name: fumadocs
description: Use when building documentation sites with Fumadocs or fumadocs-ui — Next.js docs apps with MDX content, page trees, search, and the bundled UI theme. Also when adding pages, components, layouts, sidebar tabs, or theming to an existing Fumadocs project.
---

# Fumadocs

Technical reference for Fumadocs v16 — a documentation framework for Next.js App Router with MDX, typed page trees, built-in search, and a polished UI theme.

For Vite, React Router, or TanStack Start setups, see https://fumadocs.dev/docs/mdx/vite

## Source Configuration API

### source.config.ts

```ts
import { defineDocs, defineConfig, frontmatterSchema, metaSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: frontmatterSchema.extend({
      index: z.boolean().default(false),
    }),
  },
  meta: {
    schema: metaSchema.extend({}),
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [],
    rehypePlugins: [],
    // Use (v) => [myPlugin, ...v] when order matters
  },
});
```

`defineDocs` — defines content collections (dir, schema for frontmatter/meta)
`defineConfig` — configures MDX compilation pipeline (plugins, presets)
`defineCollections` — for non-docs collections (e.g. blog):

```ts
import { defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const blog = defineCollections({
  type: 'doc',
  dir: './content/blog',
  schema: z.object({ title: z.string(), date: z.date() }),
});
```

### lib/source.ts

```ts
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

### Source API Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `source.getPage` | `(slugs?: string[], locale?: string)` | `Page \| undefined` |
| `source.getPages` | `(locale?: string)` | `Page[]` |
| `source.getPageTree` | `(locale?: string)` | `PageTree.Root` |
| `source.generateParams` | `()` | `{ slug: string[] }[]` |
| `source.getLanguages` | `()` | `{ language: string; pages: Page[] }[]` |

### Page Object

```ts
page.url        // string — resolved URL path
page.slugs      // string[] — slug segments
page.path       // string — source file path
page.data.title       // string
page.data.description // string
page.data.body        // MDX component (React)
page.data.toc         // TOCItemType[] — table of contents headings
page.data.full        // boolean — full-width mode
page.data.structuredData // structured data for search indexing
```

## Next.js App Router Setup

### next.config.mjs (must be .mjs)

```js
import { createMDX } from 'fumadocs-mdx/next';
const withMDX = createMDX();
/** @type {import('next').NextConfig} */
const config = { reactStrictMode: true };
export default withMDX(config);
```

### app/layout.tsx (root)

```tsx
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import './global.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
```

### global.css

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
```

### components/mdx.tsx

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
```

### lib/layout.shared.tsx

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: 'My App' },
    links: [],
  };
}
```

### app/docs/layout.tsx

```tsx
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
```

### app/docs/[[...slug]]/page.tsx

```tsx
import { source } from '@/lib/source';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
```

### app/(home)/layout.tsx

```tsx
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
```

## Content & Page Conventions

### Directory Structure

```
content/docs/
  index.mdx
  getting-started.mdx
  guides/
    meta.json
    setup.mdx
    deploy.mdx
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Page title (required) |
| `description` | `string` | Meta description and sidebar subtitle |
| `icon` | `string` | Icon name (from registered icons) |
| `full` | `boolean` | Full-width page mode (hides sidebar TOC) |

### meta.json

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
| `"..."` | Rest items (all unlisted pages) |
| `"...folder"` | Extract folder children inline |
| `"!name"` | Exclude a page |
| `"root": true` | Makes folder a sidebar tab root |

## Layout API

### DocsLayout (`fumadocs-ui/layouts/docs`)

| Prop | Type | Description |
|------|------|-------------|
| `tree` | `PageTree.Root` | From `source.getPageTree()` **(required)** |
| `sidebar` | `SidebarOptions` | Sidebar configuration |
| `links` | `LinkItemType[]` | Nav links array |
| `nav` | `NavOptions` | `{ title, url, transparentMode }` |
| `githubUrl` | `string` | GitHub icon in navbar |
| `tabs` | `false \| LayoutTab[]` | Sidebar folder tabs |
| `tabMode` | `"top" \| "auto"` | Tab positioning |

### SidebarOptions

```tsx
sidebar={{
  enabled: true,
  collapsible: true,       // collapse on desktop (default: true)
  defaultOpenLevel: 0,     // auto-open folders ≤ this level
  banner: <ReactNode>,     // above sidebar content
  footer: <ReactNode>,     // below sidebar content
  prefetch: true,          // prefetch links
  components: Partial<SidebarPageTreeComponents>,
}}
```

### Sidebar Tabs

```tsx
sidebar={{
  tabs: [
    {
      title: 'Components',
      description: 'UI Reference',
      url: '/docs/components',
      // urls: new Set(['/docs/components', '/docs/test'])
    },
  ],
}}
```

### DocsPage (`fumadocs-ui/layouts/docs/page`)

| Prop | Type | Description |
|------|------|-------------|
| `toc` | `TOCItemType[]` | Table of contents items |
| `full` | `boolean` | Full-width mode |
| `tableOfContent` | `TOCOptions` | Customize TOC `{ style: 'clerk' }` |
| `tableOfContentPopover` | `TOCPopoverOptions` | Mobile TOC popover |

Child components: `DocsTitle`, `DocsDescription`, `DocsBody`

### HomeLayout (`fumadocs-ui/layouts/home`)

Same `baseOptions` pattern — `nav`, `links`, `githubUrl`.

### Navigation Links (LinkItemType)

```tsx
// Simple link
{ text: 'Blog', url: '/blog', icon: <BookIcon />, secondary: false }

// Icon button
{ type: 'icon', label: 'Visit Blog', icon: <BookIcon />, text: 'Blog', url: '/blog' }

// External
{ type: 'icon', url: 'https://github.com/...', text: 'GitHub', icon: <GitHubIcon />, external: true }
```

## UI Components Reference

### Import Paths

Page components from `fumadocs-ui/layouts/docs/page`:
- `DocsPage`, `DocsBody`, `DocsTitle`, `DocsDescription`
- `MarkdownCopyButton`, `ViewOptionsPopover`

Default MDX components from `fumadocs-ui/mdx` (auto-registered):
- `Cards`, `Card`, `Callout`, `Steps`, `Step`, `Heading`, code blocks

Separate imports (register in components/mdx.tsx):

| Component | Import Path |
|-----------|-------------|
| `Tab`, `Tabs` | `fumadocs-ui/components/tabs` |
| `TypeTable` | `fumadocs-ui/components/type-table` |
| `Files`, `File`, `Folder` | `fumadocs-ui/components/files` |
| `Banner` | `fumadocs-ui/components/banner` |
| `InlineTOC` | `fumadocs-ui/components/inline-toc` |
| `ImageZoom` | `fumadocs-ui/components/image-zoom` |
| `Accordion`, `Accordions` | `fumadocs-ui/components/accordion` |
| `Steps`, `Step` | `fumadocs-ui/components/steps` |

### Callout

```mdx
<Callout>Default info callout</Callout>
<Callout title="Warning" type="warn">Warning message</Callout>
<Callout title="Error" type="error">Error message</Callout>
```

Props: `title?: string`, `type?: 'info' | 'warn' | 'error'`

### Card / Cards

```mdx
<Cards>
  <Card href="/docs/start" title="Getting Started">Description text</Card>
  <Card icon={<HomeIcon />} href="/" title="Home">With icon</Card>
  <Card title="No link">href is optional</Card>
</Cards>
```

Props: `href?: string`, `title: string`, `icon?: ReactNode`, children = description

### Tabs / Tab

```mdx
<Tabs items={['JavaScript', 'Rust']} defaultIndex={1}>
  <Tab value="JavaScript">JS content</Tab>
  <Tab value="Rust">Rust content</Tab>
</Tabs>

{/* Synced across groups */}
<Tabs groupId="language" items={['JS', 'Rust']} persist>
  <Tab value="JS">...</Tab>
  <Tab value="Rust">...</Tab>
</Tabs>
```

Tabs props: `items: string[]`, `defaultIndex?: number`, `groupId?: string`, `persist?: boolean`
Tab props: `value: string`

### TypeTable

```mdx
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

### Files / File / Folder

```mdx
<Files>
  <Folder name="app" defaultOpen>
    <File name="layout.tsx" />
    <File name="page.tsx" />
  </Folder>
  <File name="package.json" />
</Files>
```

Folder props: `name: string`, `defaultOpen?: boolean`
File props: `name: string`

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

### Banner

```tsx
import { Banner } from 'fumadocs-ui/components/banner';

<Banner>Announcement text</Banner>
<Banner id="unique-id">Closeable banner (id enables close button + persistence)</Banner>
<Banner changeLayout={false}>Won't modify sidebar/layout height</Banner>
```

Props: `id?: string` (enables close), `changeLayout?: boolean` (default: true)

### InlineTOC

```mdx
<InlineTOC items={toc} />
```

### ImageZoom

```mdx
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';

<ImageZoom src="/screenshot.png" alt="Description" width={800} height={400} />
```

### createRelativeLink

```tsx
import { createRelativeLink } from 'fumadocs-ui/mdx';

<MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
```

Overrides `<a>` to resolve relative file paths like `[Link](./other-page.mdx)`.

## Theming

### Color Presets (replace in global.css)

```css
@import 'fumadocs-ui/css/neutral.css';  /* default gray */
@import 'fumadocs-ui/css/ocean.css';    /* blue */
@import 'fumadocs-ui/css/purple.css';   /* purple */
```

### CSS Variables

```css
@theme {
  --color-fd-background: hsl(0, 0%, 96%);
  --color-fd-foreground: hsl(0, 0%, 3.9%);
  --color-fd-primary: hsl(0, 0%, 9%);
  --color-fd-primary-foreground: hsl(0, 0%, 98%);
  --color-fd-muted: hsl(0, 0%, 96.1%);
  --color-fd-muted-foreground: hsl(0, 0%, 45.1%);
  --color-fd-popover: hsl(0, 0%, 98%);
  --color-fd-popover-foreground: hsl(0, 0%, 15.1%);
  --color-fd-card: hsl(0, 0%, 94.7%);
  --color-fd-card-foreground: hsl(0, 0%, 3.9%);
  --color-fd-border: hsla(0, 0%, 80%, 50%);
  --color-fd-accent: hsla(0, 0%, 82%, 50%);
  --color-fd-accent-foreground: hsl(0, 0%, 9%);
  --color-fd-ring: hsl(0, 0%, 63.9%);
  --color-fd-secondary: hsl(0, 0%, 93.1%);
  --color-fd-secondary-foreground: hsl(0, 0%, 9%);
}

.dark {
  --color-fd-background: hsl(0, 0%, 7.04%);
  --color-fd-foreground: hsl(0, 0%, 92%);
  --color-fd-muted: hsl(0, 0%, 12.9%);
  --color-fd-muted-foreground: hsla(0, 0%, 70%, 0.8);
  --color-fd-popover: hsl(0, 0%, 11.6%);
  --color-fd-popover-foreground: hsl(0, 0%, 86.9%);
  --color-fd-card: hsl(0, 0%, 9.8%);
  --color-fd-card-foreground: hsl(0, 0%, 98%);
  --color-fd-border: hsla(0, 0%, 40%, 20%);
  --color-fd-primary: hsl(0, 0%, 98%);
  --color-fd-primary-foreground: hsl(0, 0%, 9%);
  --color-fd-secondary: hsl(0, 0%, 12.9%);
  --color-fd-secondary-foreground: hsl(0, 0%, 92%);
  --color-fd-accent: hsla(0, 0%, 40.9%, 30%);
  --color-fd-accent-foreground: hsl(0, 0%, 90%);
  --color-fd-ring: hsl(0, 0%, 54.9%);
}
```

## Search

### Orama (zero-config)

`app/api/search/route.ts`:

```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
```

### i18n Search

```ts
export const { GET } = createFromSource(source, {
  localeMap: {
    en: { language: 'english' },
    ru: { language: 'russian' },
  },
});
```

### Chinese/Japanese tokenizer

```ts
import { createTokenizer } from '@orama/tokenizers/mandarin';

export const { GET } = createFromSource(source, {
  localeMap: {
    cn: {
      components: { tokenizer: createTokenizer() },
      search: { threshold: 0, tolerance: 0 },
    },
  },
});
```

## CLI

```bash
pnpm dlx @fumadocs/cli add banner files    # download components locally
pnpm dlx @fumadocs/cli customise           # eject/customize components
pnpm dlx @fumadocs/cli tree ./src ./out.mdx # generate file tree MDX
```

## MDX Plugins

```ts
// source.config.ts
import { defineConfig } from 'fumadocs-mdx/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { remarkInstall } from 'fumadocs-docgen';
import { remarkCodeTab, remarkStructure } from 'fumadocs-core/mdx-plugins';

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath, [remarkInstall, { persist: { id: 'pm' } }]],
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
```

Built-in plugins from `fumadocs-core/mdx-plugins`:
- `remarkStructure` — extracts structured data for search
- `remarkCodeTab` — `{ parseMdx: true }` for MDX in tabs
- `remarkMdxFiles` — code blocks to file structure components
- `remarkHeading` — heading processing
- `remarkImage` — image optimization

## Common Gotchas

1. **`next.config.mjs` not `.ts`** — `createMDX()` requires ESM, use `.mjs`
2. **Missing CSS imports** — need BOTH `preset.css` AND a color preset
3. **Import paths changed in v16** — page components: `fumadocs-ui/layouts/docs/page`, RootProvider: `fumadocs-ui/provider/next`
4. **`source.getPageTree()`** — method call, not property
5. **`suppressHydrationWarning`** on `<html>` — required for dark mode
6. **Node >= 22** required
7. **Components not rendering** — register in `components/mdx.tsx`, export `useMDXComponents`
8. **`createRelativeLink(source, page)`** — pass as `a` component for relative MDX links
9. **`providerImportSource`** — needed for Vite frameworks, not Next.js
10. **`defineDocs` vs `defineConfig`** — collections vs MDX pipeline, both in source.config.ts

## Reference

- Full docs: https://fumadocs.dev/docs
- UI components: https://fumadocs.dev/docs/ui
- Search: https://fumadocs.dev/docs/headless/search/orama
- Source API: https://fumadocs.dev/docs/headless/source-api
- GitHub: https://github.com/fuma-nama/fumadocs
