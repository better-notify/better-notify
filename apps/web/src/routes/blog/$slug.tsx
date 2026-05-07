import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Suspense } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import browserCollections from 'collections/browser';
import { blogSource, mapPageToPost } from '@/lib/blog-source';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { useMDXComponents } from '@/components/mdx';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/blog/$slug')({
  component: BlogArticlePage,
  loader: async ({ params }) => {
    const data = await serverLoader({ data: params.slug });
    await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };

    const title = `${loaderData.pageTitle} — ${appConfig.name} Blog`;
    const description = loaderData.pageDescription ?? 'Better-Notify blog.';
    const url = `${appConfig.baseUrl}/blog/${loaderData.slug}`;
    const image = loaderData.pageImage ?? `${appConfig.baseUrl}/og-image.png`;

    const { meta, links } = seo({
      title,
      description,
      image,
      url,
      canonicalUrl: url,
      type: 'article',
      article: {
        publishedTime: loaderData.pageDate,
        author: loaderData.pageAuthor,
        section: loaderData.pageCategory ?? undefined,
        tags: loaderData.pageTags,
      },
    });

    return { meta, links };
  },
});

const serverLoader = createServerFn({
  method: 'GET',
})
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const pages = blogSource.getPages();
    const page = pages.find((p) => p.slugs[p.slugs.length - 1] === slug);
    if (!page) throw notFound();

    const post = mapPageToPost(page);
    const image = (page.data as Record<string, unknown>).image as string | undefined;

    return {
      path: page.path,
      slug: post.slug,
      pageTitle: post.title,
      pageDescription: post.description || null,
      pageDate: post.date,
      pageAuthor: post.author,
      pageTags: post.tags,
      pageCategory: post.category,
      pageImage: image ?? null,
    };
  });

const clientLoader = browserCollections.blogPosts.createClientLoader({
  component({ toc, default: MDX }, _props: undefined) {
    return (
      <>
        {toc.length >= 2 && <InlineTOC items={toc} className="mb-8" />}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDX components={useMDXComponents()} />
        </div>
      </>
    );
  },
});

function BlogArticlePage() {
  const loaderData = Route.useLoaderData();

  return (
    <>
      <LandingHeader />
      <main className="min-h-screen">
        <article className="mx-auto w-full max-w-[1200px] px-5 py-12 md:px-8">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="text-muted-foreground flex list-none items-center gap-1.5 p-0 text-sm">
              <li>
                <Link to="/blog" className="hover:text-foreground no-underline transition-colors">
                  Blog
                </Link>
              </li>
              {loaderData.pageCategory && (
                <>
                  <li><CaretRightIcon size={12} className="text-border" /></li>
                  <li>
                    <Link
                      to="/blog"
                      search={{ category: loaderData.pageCategory }}
                      className="hover:text-foreground capitalize no-underline transition-colors"
                    >
                      {loaderData.pageCategory}
                    </Link>
                  </li>
                </>
              )}
              <li><CaretRightIcon size={12} className="text-border" /></li>
              <li className="text-foreground font-medium">{loaderData.pageTitle}</li>
            </ol>
          </nav>
          <header className="mb-10">
            <h1
              className="text-foreground mb-3 text-3xl font-bold tracking-tight md:text-4xl"
              style={{ lineHeight: 1.15 }}
            >
              {loaderData.pageTitle}
            </h1>
            {loaderData.pageDescription && (
              <p className="text-muted-foreground mb-4 text-lg leading-relaxed">
                {loaderData.pageDescription}
              </p>
            )}
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <span>{loaderData.pageAuthor}</span>
              <span className="text-border">·</span>
              <time>
                {new Date(loaderData.pageDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </time>
            </div>
            {loaderData.pageTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {loaderData.pageTags.map((tag) => (
                  <span
                    key={tag}
                    className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>
          <Suspense>{clientLoader.useContent(loaderData.path)}</Suspense>
        </article>
      </main>
      <Footer />
    </>
  );
}
