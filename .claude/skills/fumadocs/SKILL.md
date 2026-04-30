---
name: fumadocs
description: Use when building documentation sites with Fumadocs or fumadocs-ui — Next.js docs apps with MDX content, page trees, search, and the bundled UI theme. Also when adding pages, components, layouts, sidebar tabs, or theming to an existing Fumadocs project.
---

# Fumadocs

Documentation framework for Next.js (App Router) with MDX content, typed page trees, built-in search, and a polished default UI theme. Written against Fumadocs v16 (April 2026).

For Vite, React Router, or TanStack Start setups, see https://fumadocs.dev/docs/mdx/vite

## When to Use

- Setting up a new documentation site
- Adding/editing MDX pages, folders, or navigation
- Configuring search (Orama, Algolia)
- Theming or customizing the UI layer
- Adding fumadocs-ui components (Cards, Tabs, TypeTable, etc.)

## Quick Start (Next.js App Router)

### Install

```bash
pnpm add fumadocs-mdx fumadocs-core fumadocs-ui @types/mdx
```

### Key Files

**source.config.ts** (repo root)

```ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig();
```

**next.config.mjs** — must be `.mjs` for ESM resolution

```js
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = { reactStrictMode: true };

export default withMDX(config);
```

**lib/source.ts**

```ts
import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
```

**app/layout.tsx** (root)

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

**global.css**

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
```

**components/mdx.tsx**

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

**lib/layout.shared.tsx**

```tsx
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'My App',
    },
    links: [],
  };
}
```

**app/docs/layout.tsx**

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

**app/docs/[[...slug]]/page.tsx**

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

**app/(home)/layout.tsx** (optional landing page)

```tsx
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
```

## Content Structure

```
content/docs/
  index.mdx           # /docs root page
  getting-started.mdx  # /docs/getting-started
  guides/
    meta.json          # folder config (title, order)
    setup.mdx          # /docs/guides/setup
    deploy.mdx         # /docs/guides/deploy
```

### Frontmatter

```yaml
---
title: My Page
description: Short description for meta tags and sidebar
icon: HomeIcon
full: false
---
```

### meta.json (folder ordering & config)

```json
{
  "title": "Guides",
  "icon": "BookIcon",
  "pages": [
    "setup",
    "---Getting Started---",
    "deploy",
    "...rest",
    "!hidden-page"
  ]
}
```

- `"---Text---"` — separator with label
- `"..."` — rest items (all unlisted pages)
- `"...folder"` — extract folder items inline
- `"!name"` — exclude a page
- `"root": true` in meta.json — makes folder a sidebar tab root

## DocsLayout Props

| Prop | Type | Purpose |
|------|------|---------|
| `tree` | `PageTree.Root` | Page tree from `source.getPageTree()` (required) |
| `sidebar` | `SidebarOptions` | Sidebar config (see below) |
| `links` | `LinkItemType[]` | Nav links |
| `nav` | `NavOptions` | Navbar config |
| `githubUrl` | `string` | GitHub link in nav |
| `tabs` | `false \| LayoutTab[]` | Sidebar folder tabs |
| `tabMode` | `"top" \| "auto"` | Tab display mode |

### Sidebar Options

```tsx
<DocsLayout
  sidebar={{
    enabled: true,
    collapsible: true,
    defaultOpenLevel: 0,
    banner: <div>Sidebar Banner</div>,
    footer: <div>Sidebar Footer</div>,
    prefetch: true,
  }}
/>
```

### Sidebar Tabs

```tsx
<DocsLayout
  sidebar={{
    tabs: [
      {
        title: 'Components',
        description: 'UI Reference',
        url: '/docs/components',
      },
    ],
  }}
/>
```

Or use `"root": true` in a folder's `meta.json` to auto-generate tabs.

## UI Components

All from `fumadocs-ui/*`. Default MDX components (Cards, Callouts, Code Blocks, Headings) auto-register via `defaultMdxComponents`.

### Component Quick Reference

| Component | Import | Usage |
|-----------|--------|-------|
| `Cards` / `Card` | `fumadocs-ui/mdx` (default) | Link cards with icon, title, description |
| `Callout` | `fumadocs-ui/mdx` (default) | Info/warning/error admonitions |
| `Steps` / `Step` | `fumadocs-ui/mdx` (default) | Numbered step guides |
| `Tab` / `Tabs` | `fumadocs-ui/components/tabs` | Tabbed content (register in components/mdx.tsx) |
| `TypeTable` | `fumadocs-ui/components/type-table` | API type documentation table |
| `Files` / `File` / `Folder` | `fumadocs-ui/components/files` | File tree display |
| `Banner` | `fumadocs-ui/components/banner` | Top-of-page announcements |
| `InlineTOC` | `fumadocs-ui/components/inline-toc` | Inline table of contents |
| `ImageZoom` | `fumadocs-ui/components/image-zoom` | Zoomable images |

### Registering Extra Components for MDX

```tsx
// components/mdx.tsx
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    ...components,
  } satisfies MDXComponents;
}
```

### TypeTable Example

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

### Cards Example

```mdx
import { HomeIcon } from 'lucide-react';

<Cards>
  <Card href="/docs/getting-started" title="Getting Started">
    Learn the basics
  </Card>
  <Card icon={<HomeIcon />} href="/" title="Home">
    Back to home
  </Card>
</Cards>
```

### Files Example

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

## Theming

### Color Presets

Replace `neutral.css` with another preset in `global.css`:

```css
@import 'fumadocs-ui/css/ocean.css';
@import 'fumadocs-ui/css/purple.css';
@import 'fumadocs-ui/css/neutral.css';  /* default */
```

### Custom Colors via CSS Variables

```css
@theme {
  --color-fd-background: hsl(0, 0%, 96%);
  --color-fd-foreground: hsl(0, 0%, 3.9%);
  --color-fd-primary: hsl(0, 0%, 9%);
  --color-fd-primary-foreground: hsl(0, 0%, 98%);
  --color-fd-muted: hsl(0, 0%, 96.1%);
  --color-fd-muted-foreground: hsl(0, 0%, 45.1%);
  --color-fd-popover: hsl(0, 0%, 98%);
  --color-fd-card: hsl(0, 0%, 94.7%);
  --color-fd-border: hsla(0, 0%, 80%, 50%);
  --color-fd-accent: hsla(0, 0%, 82%, 50%);
  --color-fd-ring: hsl(0, 0%, 63.9%);
  --color-fd-secondary: hsl(0, 0%, 93.1%);
}

.dark {
  --color-fd-background: hsl(0, 0%, 7.04%);
  --color-fd-foreground: hsl(0, 0%, 92%);
}
```

## Search

### Built-in Orama (zero-config)

Create `app/api/search/route.ts`:

```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source);
```

### i18n Search

```ts
import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(source, {
  localeMap: {
    en: { language: 'english' },
    ru: { language: 'russian' },
  },
});
```

For Algolia setup, see https://fumadocs.dev/docs/ui/search/algolia

## CLI

```bash
pnpm dlx @fumadocs/cli add banner files    # add specific components locally
pnpm dlx @fumadocs/cli customise           # eject/customize components
pnpm dlx @fumadocs/cli tree ./src ./out.mdx # generate file tree MDX
```

Use the CLI to download components locally when you need full control over styling. Otherwise, use the bundled imports.

## Common Gotchas

1. **`next.config.mjs` not `.ts`** — `createMDX()` requires ESM resolution, use `.mjs`
2. **Missing CSS imports** — you need BOTH `fumadocs-ui/css/preset.css` AND a color preset in global.css
3. **`defineDocs` vs `defineConfig`** — `defineDocs()` defines content collections; `defineConfig()` configures MDX compilation. Both in `source.config.ts`, different purposes
4. **`suppressHydrationWarning`** on `<html>` — required for dark mode class injection
5. **Node >= 22** required
6. **Extra components not rendering in MDX** — register them in `components/mdx.tsx`
7. **`providerImportSource`** — needed for Vite-based frameworks (not Next.js): `providerImportSource: '@/mdx-components'` in source.config.ts
8. **Import paths** — page components are from `fumadocs-ui/layouts/docs/page`, NOT `fumadocs-ui/page`. RootProvider is from `fumadocs-ui/provider/next` for Next.js
9. **`source.getPageTree()`** is a method call, not a property access
10. **`createRelativeLink(source, page)`** — use this as the `a` component in MDX to support relative file path links between pages

## Reference

- Full docs: https://fumadocs.dev/docs
- UI components: https://fumadocs.dev/docs/ui
- Search: https://fumadocs.dev/docs/headless/search/orama
- GitHub: https://github.com/fuma-nama/fumadocs
