import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { CalendarIcon, TagIcon, FunnelIcon } from '@phosphor-icons/react';
import { z } from 'zod';
import { useAnalytics } from '@/hooks/use-analytics';
import { getAllBlogPosts } from '@/lib/blog-source';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';

const searchSchema = z.object({
  category: z.string().optional(),
});

export const Route = createFileRoute('/blog/')({
  component: BlogIndexPage,
  validateSearch: searchSchema,
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

const serverLoader = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getAllBlogPosts();
});

function BlogIndexPage() {
  const { posts, categories, allTags } = Route.useLoaderData();
  const { category: activeCategory } = Route.useSearch();
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const navigate = Route.useNavigate();
  const analytics = useAnalytics('blog');

  const setActiveCategory = (cat: string | null) => {
    analytics.track('filter').action('click', { type: 'category', value: cat ?? 'all' });
    void navigate({ search: { category: cat ?? undefined } });
  };

  const filtered = posts.filter((post) => {
    if (activeCategory && post.category !== activeCategory) return false;
    if (activeTags.length > 0 && !activeTags.some((t) => post.tags.includes(t))) return false;
    return true;
  });

  const toggleTag = (tag: string) => {
    const active = activeTags.includes(tag);
    analytics
      .track('filter')
      .action('click', { type: 'tag', value: tag, toggled: active ? 'off' : 'on' });
    setActiveTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]));
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
            <Button
              variant={!activeCategory ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className="capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5 md:hidden">
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={activeTags.includes(tag) ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-8">
            <div className="min-w-0 flex-1">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  No posts match the selected filters.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered.map((post, i) => {
                    const isFeatured = i === 0;
                    return (
                      <Link
                        key={post.slug}
                        to="/blog/$slug"
                        params={{ slug: post.slug }}
                        onClick={() =>
                          analytics.track('article').action('click', {
                            slug: post.slug,
                            title: post.title,
                            position: i,
                          })
                        }
                        className={`border-border bg-card group flex overflow-hidden rounded-xl border no-underline transition-all duration-200 hover:border-bn-slate-300 hover:shadow-sm dark:hover:border-bn-slate-700 ${
                          isFeatured ? 'sm:col-span-2' : ''
                        }`}
                      >
                        {post.image && (
                          <div
                            className={`relative hidden shrink-0 sm:block ${isFeatured ? 'w-56 md:w-72' : 'w-40 md:w-48'}`}
                          >
                            <img
                              src={post.image}
                              alt={post.title}
                              className="absolute inset-0 h-full w-full object-cover object-center"
                            />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 md:p-5">
                          <div className="mb-2 flex items-center gap-2">
                            {post.category && (
                              <Badge variant="default" className="capitalize">
                                {post.category}
                              </Badge>
                            )}
                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                              <CalendarIcon size={12} />
                              {new Date(post.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                timeZone: 'UTC',
                              })}
                            </span>
                          </div>
                          <h2
                            className={`text-foreground group-hover:text-primary mb-1.5 font-semibold tracking-tight transition-colors ${isFeatured ? 'text-xl' : 'text-lg'}`}
                          >
                            {post.title}
                          </h2>
                          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                            {post.description}
                          </p>
                          {post.tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {post.tags.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveCategory(null)}
                      className={`justify-start ${!activeCategory ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                    >
                      All posts
                    </Button>
                    {categories.map((cat) => (
                      <Button
                        key={cat}
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        className={`justify-start capitalize ${activeCategory === cat ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                      >
                        {cat}
                      </Button>
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
                        <Button
                          key={tag}
                          variant={activeTags.includes(tag) ? 'default' : 'outline'}
                          size="xs"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Button>
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
