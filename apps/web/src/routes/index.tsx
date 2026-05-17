import { Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

import { LandingHeader } from '@/components/landing/header';
import { AnnouncementStrip } from '@/components/landing/announcement-strip';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Channels } from '@/components/landing/channels';
import { Pipeline } from '@/components/landing/pipeline';
import { Mcp } from '@/components/landing/mcp';
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
      title: `${appConfig.name} — Typed Notifications for Node.js & Bun`,
      description:
        'Send typed notifications across email, WhatsApp, SMS, Telegram, Slack, and Discord from one catalog. Node.js, Bun, Cloudflare Workers, and Vercel.',
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
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${appConfig.baseUrl}#website`,
                url: appConfig.baseUrl,
                name: appConfig.name,
                description:
                  'Typed notifications for Node.js, Bun, Cloudflare Workers, and Vercel. Define once, send everywhere with full TypeScript support.',
                inLanguage: appConfig.locale.bcp47,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${appConfig.baseUrl}/docs?search={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@type': 'SoftwareApplication',
                '@id': `${appConfig.baseUrl}#software`,
                name: appConfig.name,
                url: appConfig.baseUrl,
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Node.js, Bun, Cloudflare Workers, Vercel',
                description:
                  'Typed notifications for Node.js, Bun, Cloudflare Workers, and Vercel. Define once, send everywhere with full TypeScript support.',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                author: {
                  '@type': 'Person',
                  '@id': `${appConfig.baseUrl}#author`,
                  name: 'Lucas Reis',
                  url: 'https://github.com/thereis',
                  sameAs: [
                    'https://x.com/lucasreis',
                    'https://github.com/thereis',
                    'https://linkedin.com/in/lucasreismdias',
                  ],
                },
              },
              {
                '@type': 'FAQPage',
                '@id': `${appConfig.baseUrl}#faq`,
                mainEntity: [
                  {
                    '@type': 'Question',
                    name: 'What is Better-Notify?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Better-Notify is an open-source, end-to-end typed notification library for Node.js and Bun. You define a single typed catalog and send notifications across email, SMS, WhatsApp, Telegram, Slack, and Discord — with full TypeScript support, schema validation, and provider failover.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'How is Better-Notify different from Novu, Knock, or Courier?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Unlike cloud notification platforms (Novu, Knock, Courier), Better-Notify is a library — not a SaaS. It lives in your codebase with zero vendor lock-in, no per-send pricing, and full type safety from catalog definition to send call. You own your infrastructure and swap providers without touching route definitions.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Which notification channels does Better-Notify support?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Better-Notify supports email (SMTP, Resend, Cloudflare Email, SES, Mailchimp), SMS (Twilio), WhatsApp (Meta Cloud API), Telegram (Bot API), Slack (Block Kit), Discord (Webhooks), push notifications (APNs, FCM, Web Push), and custom channels via defineChannel().',
                    },
                  },
                ],
              },
            ],
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
      <AnnouncementStrip />
      <LandingHeader />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Channels />
        <Pipeline />
        <Mcp />
        <Comparison />
        <Install />
        <Cta />
        <BlogAndAuthor posts={latestPosts} />
      </main>
      <Footer />
    </Suspense>
  );
}
