import { createFileRoute, Link } from '@tanstack/react-router';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { integrations } from '@/lib/integrations';

export const Route = createFileRoute('/integrations/')({
  component: IntegrationsPage,
  head: () => {
    const url = `${appConfig.baseUrl}/integrations`;
    const { meta, links } = seo({
      title: `Integrations — ${appConfig.name}`,
      description:
        'Connect Better-Notify to SMTP, Resend, Cloudflare Email, Twilio, Slack, Discord, Telegram, and more. Type-safe notifications with any provider.',
      url,
      canonicalUrl: url,
      keywords:
        'better-notify integrations, email api nodejs, sms api nodejs, slack notifications, discord webhooks, telegram bot nodejs',
    });
    return { meta, links };
  },
});

const channelGroups = [
  { label: 'Email', channel: 'email' },
  { label: 'SMS', channel: 'sms' },
  { label: 'Messaging', channel: 'slack' },
  { label: 'Templates', channel: 'template' },
] as const;

function IntegrationsPage() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-[1200px] px-5 py-16 md:px-8">
        <header className="mb-16 text-center">
          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Integrations
          </h1>
          <p className="text-muted-foreground mx-auto max-w-[560px] text-lg leading-relaxed">
            Connect Better-Notify to the providers you already use. One catalog, any transport.
          </p>
        </header>

        {channelGroups.map((group) => {
          const items = integrations.filter((i) =>
            group.channel === 'slack'
              ? ['slack', 'discord', 'telegram'].includes(i.channel)
              : i.channel === group.channel,
          );
          if (items.length === 0) return null;
          return (
            <section key={group.channel} className="mb-14">
              <h2 className="text-foreground mb-6 text-2xl font-semibold">{group.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((integration) => (
                  <Link
                    key={integration.slug}
                    to="/integrations/$slug"
                    params={{ slug: integration.slug }}
                    className="border-border hover:border-foreground/20 group rounded-lg border p-5 no-underline transition-colors"
                  >
                    <h3 className="text-foreground mb-1 text-base font-semibold">
                      {integration.name}
                    </h3>
                    <span className="text-muted-foreground mb-3 inline-block rounded-md bg-fd-muted px-2 py-0.5 text-xs">
                      {integration.channelLabel}
                    </span>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {integration.tagline}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <Footer />
    </>
  );
}
