import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { CalendarIcon, TagIcon, FunnelIcon } from '@phosphor-icons/react';
import { blogSource } from '@/lib/blog-source';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/blog/')({
  component: BlogIndexPage,
  loader: async () => {
    return await serverLoader();
  },
  head: () => {
    const title = `Blog — ${appConfig.name}`;
    const description = 'Articles, guides, and updates from the Better-Notify team.';
    const url = `${appConfig.baseUrl}/blog`;

    const { meta, links } = seo({
      title,
      description,
      url,
      canonicalUrl: url,
    });

    return { meta, links };
  },
});

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  category: string | null;
};

const serverLoader = createServerFn({
  method: 'GET',
}).handler(async () => {
  const pages = blogSource.getPages();

  const posts: BlogPost[] = pages
    .map((page) => {
      const data = page.data as unknown as Record<string, unknown>;
      const category = page.slugs.length > 1 ? page.slugs[0] : null;
      const slug = page.slugs[page.slugs.length - 1];

      return {
        slug,
        title: page.data.title,
        description: (page.data.description as string) ?? '',
        date: (data.date as string) ?? '',
        author: (data.author as string) ?? 'Lucas Reis',
        tags: (data.tags as string[]) ?? [],
        category,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[];
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();

  return { posts, categories, allTags };
});

function BlogIndexPage() {
  const { posts, categories, allTags } = Route.useLoaderData();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const filtered = posts.filter((post) => {
    if (activeCategory && post.category !== activeCategory) return false;
    if (activeTags.length > 0 && !activeTags.some((t) => post.tags.includes(t))) return false;
    return true;
  });

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <>
      <LandingHeader />
      <main className="min-h-screen py-16 md:py-20">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <div className="mb-12">
            <p className="bn-eyebrow mb-3">Blog</p>
            <h1
              className="text-foreground mb-4 text-4xl font-bold tracking-tight"
              style={{ lineHeight: 1.1 }}
            >
              Articles & Updates
            </h1>
            <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed">
              Guides, integrations, and news from the Better-Notify project.
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-2 md:hidden">
            <button
              onClick={() => setActiveCategory(null)}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                !activeCategory
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activeCategory === cat
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex gap-8">
            <div className="min-w-0 flex-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  No posts match the selected filters.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered.map((post, i) => (
                    <Link
                      key={post.slug}
                      to="/blog/$slug"
                      params={{ slug: post.slug }}
                      className={`border-border bg-card group block rounded-xl border p-5 no-underline transition-colors hover:bg-bn-slate-50 dark:hover:bg-bn-slate-900 ${
                        i === 0 ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        {post.category && (
                          <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[10px] font-medium capitalize">
                            {post.category}
                          </span>
                        )}
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <CalendarIcon size={12} />
                          {new Date(post.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <h2 className="text-foreground group-hover:text-primary mb-2 text-lg font-semibold tracking-tight transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-muted-foreground mb-3 text-sm leading-relaxed line-clamp-2">
                        {post.description}
                      </p>
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <aside className="hidden w-[220px] shrink-0 md:block">
              <div className="sticky top-20">
                <div className="mb-6">
                  <h3 className="text-foreground mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    <FunnelIcon size={14} />
                    Categories
                  </h3>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setActiveCategory(null)}
                      className={`cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                        !activeCategory
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All posts
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        className={`cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium capitalize transition-colors ${
                          activeCategory === cat
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {allTags.length > 0 && (
                  <div>
                    <h3 className="text-foreground mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <TagIcon size={14} />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                            activeTags.includes(tag)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
