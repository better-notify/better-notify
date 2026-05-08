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
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/')({
  component: LandingPage,
  loader: async () => {
    return await getLatestPosts();
  },
  head: () => {
    const { meta, links } = seo({
      title: `${appConfig.name}: Typed Notifications for Node.js`,
      description:
        'Type-safe notification infrastructure for Node.js. Send email, SMS, Telegram, Slack, and Discord from one typed catalog with full TypeScript support.',
      url: appConfig.baseUrl,
      canonicalUrl: appConfig.baseUrl,
    });
    return {
      meta,
      links,
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: appConfig.name,
            url: appConfig.baseUrl,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Node.js',
            description:
              'Type-safe notification infrastructure for Node.js. Define once, send everywhere with full TypeScript support.',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: {
              '@type': 'Organization',
              name: appConfig.name,
              url: appConfig.baseUrl,
            },
          }),
        },
      ],
    };
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
