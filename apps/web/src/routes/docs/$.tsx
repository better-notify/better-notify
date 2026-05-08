import { createFileRoute, notFound } from '@tanstack/react-router';
import { DocsLayout, useDocsLayout } from 'fumadocs-ui/layouts/docs';
import { createServerFn } from '@tanstack/react-start';
import { source } from '@/lib/source';
import browserCollections from 'collections/browser';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { baseOptions } from '@/lib/layout.shared';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import React, { Suspense } from 'react';
import { useMDXComponents } from '@/components/mdx';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { SidebarIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { LandingHeader } from '@/components/landing/header';

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };

    const title = `${loaderData.pageTitle} — ${appConfig.name} Docs`;
    const description = loaderData.pageDescription ?? 'Better-Notify documentation and guides.';
    const url = `${appConfig.baseUrl}/docs/${loaderData.slugs.join('/')}`;
    const image = `${appConfig.baseUrl}/og/docs/${loaderData.slugs.join('/')}/image.png`;

    const { meta, links } = seo({
      title,
      description,
      image,
      url,
      canonicalUrl: url,
    });

    return { meta, links };
  },
});

const serverLoader = createServerFn({
  method: 'GET',
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
      slugs,
      pageTitle: page.data.title,
      pageDescription: (page.data.description as string | undefined) ?? null,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    _props: undefined,
  ) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={useMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  },
});

function MobileSidebarHeader({
  title,
  className,
  ...props
}: React.ComponentProps<'header'> & { title?: string }) {
  const { slots } = useDocsLayout();

  return (
    <header
      {...props}
      className={cn(
        '[grid-area:header] sticky top-(--fd-docs-row-1) z-30 flex items-center gap-2 ps-4 pe-2.5 border-b transition-colors backdrop-blur-sm bg-fd-background/80 h-(--fd-header-height) md:hidden max-md:layout:[--fd-header-height:--spacing(14)]',
        className,
      )}
    >
      <span className="flex-1 truncate text-sm font-medium text-fd-foreground">
        {title}
      </span>
      <slots.sidebar.trigger className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground">
        <SidebarIcon className="size-4" />
      </slots.sidebar.trigger>
    </header>
  );
}

function Page() {
  const { slugs: _slugs, pageTitle, pageDescription: _pageDescription, ...loaderData } =
    Route.useLoaderData();
  const data = useFumadocsLoader(loaderData);
  const header = React.useMemo(
    () =>
      function Header(props: React.ComponentProps<'header'>) {
        return <MobileSidebarHeader {...props} title={pageTitle} />;
      },
    [pageTitle],
  );
  if (!data) return null;

  return (
    <>
      <LandingHeader />
      <DocsLayout
        {...baseOptions()}
        tree={data.pageTree}
        slots={{ header }}
        containerProps={{
          style: { '--fd-banner-height': 'var(--landing-header-height, 0px)' } as React.CSSProperties,
        }}
      >
        <Suspense>{clientLoader.useContent(data.path)}</Suspense>
      </DocsLayout>
    </>
  );
}
