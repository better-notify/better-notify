import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAnalytics } from '@/hooks/use-analytics';
import { CaretRightIcon, XLogoIcon, GithubLogoIcon, LinkSimpleIcon } from '@phosphor-icons/react';
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
    if (typeof window !== 'undefined') await clientLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };

    const title = `${loaderData.pageTitle} — ${appConfig.name} Blog`;
    const description = loaderData.pageDescription ?? 'Better-Notify blog.';
    const url = `${appConfig.baseUrl}/blog/${loaderData.slug}`;
    const image = loaderData.pageImage ?? `${appConfig.baseUrl}/og/image.png`;

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
    const image = (page.data as unknown as Record<string, unknown>).image as string | undefined;

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
      <div className="mx-auto max-w-3xl">
        {toc.length >= 2 && <InlineTOC items={toc} className="mb-8" />}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDX components={useMDXComponents()} />
        </div>
      </div>
    );
  },
});

function ArticleFooter({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const analytics = useAnalytics('blog');
  const articleUrl = `${appConfig.baseUrl}/blog/${slug}/`;

  const shareOnX = useCallback(() => {
    analytics.track('share').action('click', { slug, platform: 'x' });
    const text = encodeURIComponent(`${title} ${appConfig.twitterHandle}`);
    const url = encodeURIComponent(articleUrl);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  }, [analytics, title, articleUrl, slug]);

  const copyLink = useCallback(() => {
    analytics.track('share').action('click', { slug, platform: 'copy_link' });
    void navigator.clipboard.writeText(articleUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [analytics, articleUrl, slug]);

  const githubUrl = `https://github.com/${appConfig.git.user}/${appConfig.git.repo}`;
  const xUrl = `https://x.com/${appConfig.twitterHandle.replace('@', '')}`;

  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <div className="border-border border-t pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold">Share this post</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shareOnX}
                className="border-border text-muted-foreground hover:text-foreground hover:border-bn-slate-300 dark:hover:border-bn-slate-700 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
              >
                <XLogoIcon size={14} />
                Post on X
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="border-border text-muted-foreground hover:text-foreground hover:border-bn-slate-300 dark:hover:border-bn-slate-700 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
              >
                <LinkSimpleIcon size={14} />
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold">Follow {appConfig.name}</p>
            <div className="flex items-center gap-2">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  analytics.track('follow').action('click', { slug, platform: 'github' })
                }
                className="border-border text-muted-foreground hover:text-foreground hover:border-bn-slate-300 dark:hover:border-bn-slate-700 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs no-underline transition-colors"
              >
                <GithubLogoIcon size={14} />
                GitHub
              </a>
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analytics.track('follow').action('click', { slug, platform: 'x' })}
                className="border-border text-muted-foreground hover:text-foreground hover:border-bn-slate-300 dark:hover:border-bn-slate-700 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs no-underline transition-colors"
              >
                <XLogoIcon size={14} />
                {appConfig.twitterHandle}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogArticlePage() {
  const [imageError, setImageError] = useState(false);
  const loaderData = Route.useLoaderData();
  const analytics = useAnalytics('blog');

  useEffect(() => {
    analytics.track('article').action('view', {
      slug: loaderData.slug,
      title: loaderData.pageTitle,
      author: loaderData.pageAuthor,
      category: loaderData.pageCategory,
      tags: loaderData.pageTags,
    });
  }, [loaderData.slug]);

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
                  <li aria-hidden="true" role="presentation">
                    <CaretRightIcon size={12} className="text-border" />
                  </li>
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
              <li aria-hidden="true" role="presentation">
                <CaretRightIcon size={12} className="text-border" />
              </li>
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
          {loaderData.pageImage && !imageError && (
            <img
              src={loaderData.pageImage}
              alt={loaderData.pageTitle}
              onError={() => setImageError(true)}
              className="mx-auto mb-10 block w-full rounded-lg md:w-3/4 lg:w-2/3"
            />
          )}
          <Suspense
            fallback={
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-full rounded bg-fd-muted" />
                <div className="h-4 w-5/6 rounded bg-fd-muted" />
                <div className="h-4 w-4/6 rounded bg-fd-muted" />
                <div className="mt-6 h-4 w-full rounded bg-fd-muted" />
                <div className="h-4 w-3/4 rounded bg-fd-muted" />
              </div>
            }
          >
            {clientLoader.useContent(loaderData.path)}
          </Suspense>
          <ArticleFooter title={loaderData.pageTitle} slug={loaderData.slug} />
        </article>
      </main>
      <Footer />
    </>
  );
}
