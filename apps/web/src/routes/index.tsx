import { Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Channels } from '@/components/landing/channels';
import { Pipeline } from '@/components/landing/pipeline';
import { Comparison } from '@/components/landing/comparison';
import { Install } from '@/components/landing/install';
import { Cta } from '@/components/landing/faq-cta';
import { BlogAndAuthor } from '@/components/landing/author';
import { Footer } from '@/components/landing/footer';
import { Marquee } from '@/components/landing/marquee';
import { blogSource } from '@/lib/blog-source';

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: async () => {
    return await getLatestPosts();
  },
});

const getLatestPosts = createServerFn({
  method: 'GET',
}).handler(async () => {
  const pages = blogSource.getPages();

  const posts = pages
    .map((page) => {
      const data = page.data as unknown as Record<string, unknown>;
      const category = page.slugs.length > 1 ? page.slugs[0] : null;
      const slug = page.slugs[page.slugs.length - 1];

      return {
        slug,
        title: page.data.title,
        description: (page.data.description as string) ?? '',
        date: (data.date as string) ?? '',
        category,
        tags: (data.tags as string[]) ?? [],
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return { latestPosts: posts };
});

function LandingPage() {
  const { latestPosts } = Route.useLoaderData();

  return (
    <Suspense>
      <LandingHeader />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Channels />
        <Pipeline />
        <Comparison />
        <Install />
        <Cta />
        <BlogAndAuthor posts={latestPosts} />
      </main>
      <Footer />
    </Suspense>
  );
}
