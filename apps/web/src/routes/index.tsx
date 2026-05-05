import { Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { LandingHeader } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Channels } from '@/components/landing/channels';
import { Pipeline } from '@/components/landing/pipeline';
import { Comparison } from '@/components/landing/comparison';
import { Install } from '@/components/landing/install';
import { Cta } from '@/components/landing/faq-cta';
import { Author } from '@/components/landing/author';
import { Footer } from '@/components/landing/footer';
import { Marquee } from '@/components/landing/marquee';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
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
        <Author />
      </main>
      <Footer />
    </Suspense>
  );
}
