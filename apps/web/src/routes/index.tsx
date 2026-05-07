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
import { getLatestBlogPosts } from '@/lib/blog-source';

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: async () => {
    return await getLatestPosts();
  },
});

const getLatestPosts = createServerFn({
  method: 'GET',
}).handler(async () => {
  return { latestPosts: getLatestBlogPosts(3) };
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
