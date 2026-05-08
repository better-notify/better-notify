import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { getPersona, getRelatedPersonas } from '@/lib/personas';
import { CaretRightIcon, CheckCircleIcon, ArrowRightIcon } from '@phosphor-icons/react';

export const Route = createFileRoute('/for/$slug')({
  component: PersonaPage,
  loader: async ({ params }) => {
    return await serverLoader({ data: params.slug });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };
    const url = `${appConfig.baseUrl}/for/${loaderData.slug}`;
    const { meta, links } = seo({
      title: `${appConfig.name} for ${loaderData.name} — Type-safe Notifications`,
      description: loaderData.tagline,
      url,
      canonicalUrl: url,
      keywords: `${loaderData.name.toLowerCase()} notifications, ${loaderData.name.toLowerCase()} email, ${loaderData.name.toLowerCase()} sms, better-notify ${loaderData.name.toLowerCase()}`,
    });
    return {
      meta,
      links,
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${appConfig.name} for ${loaderData.name}`,
            url,
            description: loaderData.tagline,
            about: {
              '@type': 'SoftwareApplication',
              name: appConfig.name,
              applicationCategory: 'DeveloperApplication',
            },
          }),
        },
      ],
    };
  },
});

const serverLoader = createServerFn({ method: 'GET' })
  .validator(z.string().min(1))
  .handler(({ data: slug }) => {
    const persona = getPersona(slug);
    if (!persona) throw notFound();
    const related = getRelatedPersonas(persona.related);
    return { ...persona, relatedPersonas: related };
  });

function PersonaPage() {
  const data = Route.useLoaderData();

  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[860px] px-5 py-12 md:px-8">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="text-muted-foreground flex list-none items-center gap-1.5 p-0 text-sm">
            <li>
              <Link to="/for" className="hover:text-foreground no-underline transition-colors">
                Frameworks
              </Link>
            </li>
            <li aria-hidden="true">
              <CaretRightIcon size={12} className="text-border" />
            </li>
            <li className="text-foreground font-medium">{data.name}</li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-foreground mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            {appConfig.name} for {data.name}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">{data.description}</p>
        </header>

        <section className="mb-12">
          <h2 className="text-foreground mb-4 text-xl font-semibold">Why it fits</h2>
          <ul className="space-y-2">
            {data.whyFits.map((reason) => (
              <li key={reason} className="text-muted-foreground flex items-start gap-2 text-sm">
                <CheckCircleIcon
                  size={16}
                  weight="fill"
                  className="text-foreground mt-0.5 shrink-0"
                />
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-foreground mb-4 text-xl font-semibold">Example</h2>
          <pre className="overflow-x-auto rounded-lg bg-fd-muted p-4 text-sm leading-relaxed">
            <code>{data.codeExample}</code>
          </pre>
        </section>

        <div className="mb-12 flex flex-wrap gap-3">
          <a
            href="/docs/get-started/quick-start"
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-colors hover:opacity-90"
          >
            Get started
            <ArrowRightIcon size={14} />
          </a>
          <a
            href="/integrations"
            className="border-border text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium no-underline transition-colors hover:bg-fd-muted"
          >
            Browse integrations
            <ArrowRightIcon size={14} />
          </a>
        </div>

        {data.relatedPersonas.length > 0 && (
          <section className="border-border border-t pt-10">
            <h2 className="text-foreground mb-4 text-lg font-semibold">Also works with</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.relatedPersonas.map((r) => (
                <Link
                  key={r.slug}
                  to="/for/$slug"
                  params={{ slug: r.slug }}
                  className="border-border hover:border-foreground/20 rounded-lg border p-4 no-underline transition-colors"
                >
                  <span className="text-foreground text-sm font-semibold">{r.name}</span>
                  <span className="text-muted-foreground mt-1 block text-xs">{r.tagline}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
