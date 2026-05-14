import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { getIntegration, getRelatedIntegrations } from '@/lib/integrations';
import { highlightCode } from '@/lib/highlight';
import { CodeEditor } from '@/components/code-editor';
import { PackageInstall } from '@/components/package-install';
import { Button } from '@/components/ui/button';
import { CaretRightIcon, CheckCircleIcon, ArrowRightIcon } from '@phosphor-icons/react';

export const Route = createFileRoute('/integrations/$slug')({
  component: IntegrationPage,
  loader: async ({ params }) => {
    return await serverLoader({ data: params.slug });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };
    const url = `${appConfig.baseUrl}/integrations/${loaderData.slug}`;
    const { meta, links } = seo({
      title: `${loaderData.name} Integration — ${appConfig.name}`,
      description: loaderData.tagline,
      url,
      canonicalUrl: url,
      keywords: `${loaderData.name.toLowerCase()} nodejs, ${loaderData.name.toLowerCase()} notifications, ${loaderData.name.toLowerCase()} typescript, better-notify ${loaderData.name.toLowerCase()}, send ${loaderData.channelLabel.toLowerCase()} ${loaderData.name.toLowerCase()}, ${loaderData.name.toLowerCase()} integration`,
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
            name: `${appConfig.name} ${loaderData.name} Integration`,
            url,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Node.js',
            description: loaderData.tagline,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        },
      ],
    };
  },
});

const serverLoader = createServerFn({ method: 'GET' })
  .inputValidator(z.string().min(1))
  .handler(({ data: slug }) => {
    const integration = getIntegration(slug);
    if (!integration) throw notFound();
    const related = getRelatedIntegrations(integration.related);
    const highlighted = highlightCode(integration.codeExample);
    return { ...integration, relatedIntegrations: related, highlighted };
  });

function IntegrationPage() {
  const data = Route.useLoaderData();

  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[860px] px-5 py-12 md:px-8">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="text-muted-foreground flex list-none items-center gap-1.5 p-0 text-sm">
            <li>
              <Link
                to="/integrations"
                className="hover:text-foreground no-underline transition-colors"
              >
                Integrations
              </Link>
            </li>
            <li aria-hidden="true">
              <CaretRightIcon size={12} className="text-border" />
            </li>
            <li className="text-foreground font-medium">{data.name}</li>
          </ol>
        </nav>

        <header className="mb-10">
          <span className="text-muted-foreground mb-2 inline-block rounded-md bg-fd-muted px-2.5 py-1 text-xs font-medium">
            {data.channelLabel}
          </span>
          <h1 className="text-foreground mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            {data.name} + {appConfig.name}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">{data.description}</p>
        </header>

        <section className="mb-12">
          <h2 className="text-foreground mb-4 text-xl font-semibold">Install</h2>
          <PackageInstall pkg={data.package} />
        </section>

        <section className="mb-12">
          <h2 className="text-foreground mb-4 text-xl font-semibold">Quick start</h2>
          <CodeEditor html={data.highlighted.html} filename={data.highlighted.filename} />
        </section>

        <section className="mb-12">
          <h2 className="text-foreground mb-4 text-xl font-semibold">Features</h2>
          <ul className="space-y-2">
            {data.features.map((feature) => (
              <li key={feature} className="text-muted-foreground flex items-start gap-2 text-sm">
                <CheckCircleIcon
                  size={16}
                  weight="fill"
                  className="text-foreground mt-0.5 shrink-0"
                />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <div className="mb-12 flex flex-wrap gap-3">
          <a
            href={data.docsPath}
            className="border-border text-foreground inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium no-underline transition-colors hover:bg-fd-muted"
          >
            Read the docs
            <ArrowRightIcon size={14} />
          </a>
          <a
            href="/docs/get-started/quick-start"
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium no-underline transition-colors hover:opacity-90"
          >
            Get started
            <ArrowRightIcon size={14} />
          </a>
        </div>

        {data.relatedIntegrations.length > 0 && (
          <section className="border-border border-t pt-10">
            <h2 className="text-foreground mb-4 text-lg font-semibold">Related integrations</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {data.relatedIntegrations.map((r) => (
                <Link
                  key={r.slug}
                  to="/integrations/$slug"
                  params={{ slug: r.slug }}
                  className="border-border hover:border-foreground/20 rounded-lg border p-4 no-underline transition-colors"
                >
                  <span className="text-foreground text-sm font-semibold">{r.name}</span>
                  <span className="text-muted-foreground mt-1 block text-xs">{r.channelLabel}</span>
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
