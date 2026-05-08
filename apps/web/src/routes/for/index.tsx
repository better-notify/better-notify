import { createFileRoute, Link } from '@tanstack/react-router';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { personas } from '@/lib/personas';

export const Route = createFileRoute('/for/')({
  component: PersonasPage,
  head: () => {
    const url = `${appConfig.baseUrl}/for`;
    const { meta, links } = seo({
      title: `Better-Notify for your stack — ${appConfig.name}`,
      description:
        'Type-safe notifications for Next.js, Express, Hono, Cloudflare Workers, Fastify, NestJS, tRPC, and Remix. See how Better-Notify fits your framework.',
      url,
      canonicalUrl: url,
      keywords:
        'nodejs notification library, notification sdk nodejs, nextjs send email, express notifications, hono notifications, cloudflare workers email, fastify email, nestjs notifications, trpc notifications, remix email, typed notifications framework',
    });
    return { meta, links };
  },
});

function PersonasPage() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-8">
        <header className="mb-16 text-center">
          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Better-Notify for your stack
          </h1>
          <p className="text-muted-foreground mx-auto max-w-[560px] text-lg leading-relaxed">
            One library, any framework. See how Better-Notify fits the tools you already use.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((persona) => (
            <Link
              key={persona.slug}
              to="/for/$slug"
              params={{ slug: persona.slug }}
              className="border-border hover:border-foreground/20 group rounded-lg border p-5 no-underline transition-colors"
            >
              <h2 className="text-foreground mb-2 text-base font-semibold">{persona.name}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{persona.tagline}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
