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
import { Footer } from '@/components/landing/footer';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <Suspense>
      <LandingHeader />
      <main>
        <Hero />
        <Features />
        <Channels />
        <Pipeline />
        <Comparison />
        <Install />
        <Cta />
      </main>
      <Footer />
    </Suspense>
  );
}
