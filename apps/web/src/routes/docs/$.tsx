import { createFileRoute, notFound } from '@tanstack/react-router';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { createServerFn } from '@tanstack/react-start';
import { source } from '@/lib/source';
import browserCollections from 'collections/browser';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { baseOptions } from '@/lib/layout.shared';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import { Suspense } from 'react';
import { useMDXComponents } from '@/components/mdx';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return { ...data, slugs };
  },
  head: ({ loaderData }) => {
    const slugs = loaderData?.slugs ?? [];
    const page = source.getPage(slugs);
    const title = page
      ? `${page.data.title} — ${appConfig.name} Docs`
      : `Documentation — ${appConfig.name}`;
    const description =
      (page?.data.description as string | undefined) ??
      'Better-Notify documentation and guides.';
    const url = `${appConfig.baseUrl}/docs/${slugs.join('/')}`;

    const image = `${appConfig.baseUrl}/og/docs/${slugs.join('/')}/image.png`;

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

function Page() {
  const { slugs: _slugs, ...loaderData } = Route.useLoaderData();
  const data = useFumadocsLoader(loaderData);
  if (!data) return null;

  return (
    <DocsLayout {...baseOptions()} tree={data.pageTree}>
      <Suspense>{clientLoader.useContent(data.path)}</Suspense>
    </DocsLayout>
  );
}
