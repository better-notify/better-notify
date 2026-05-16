import { useState } from 'react';
import { ArrowRightIcon, GithubLogoIcon } from '@phosphor-icons/react';
import { useAnalytics } from '@/hooks/use-analytics';

import { appConfig } from '@/lib/shared';
import { CliPreview } from '@/components/landing/cli-preview';
import { RuntimeBadges } from '@/components/landing/runtime-badges';
import { TrustedBy } from '@/components/landing/trusted-by';
import { EmailSnippet } from '@/components/landing/snippets/email';
import { WhatsappSnippet } from '@/components/landing/snippets/whatsapp';
import { TelegramSnippet } from '@/components/landing/snippets/telegram';
import { CrossTransportSnippet } from '@/components/landing/snippets/cross-transport';

function BgGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--muted-foreground) 40%, transparent) 1px, transparent 0)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
      }}
    />
  );
}

const tabs = ['email.ts', 'whatsapp.ts', 'telegram.ts', 'cross-transport.ts'] as const;

const snippets = {
  'email.ts': EmailSnippet,
  'whatsapp.ts': WhatsappSnippet,
  'telegram.ts': TelegramSnippet,
  'cross-transport.ts': CrossTransportSnippet,
} as const;

export function Hero() {
  const [active, setActive] = useState<(typeof tabs)[number]>('email.ts');
  const analytics = useAnalytics('hero');

  return (
    <section className="relative">
      <BgGrid />
      <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-14 md:px-8 md:pb-28 md:pt-20 lg:pb-32 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <h1
              className="hero-anim text-foreground mb-6 font-bold tracking-bn-snug text-balance"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', lineHeight: 1.08 }}
            >
              Typed notifications for Node.js and Bun
            </h1>

            <p
              className="hero-anim text-muted-foreground mb-10 max-w-[520px] text-[17px] leading-[1.6] text-pretty lg:mx-0"
              style={{ animationDelay: '80ms' }}
            >
              Define one{' '}
              <code className="bg-muted text-foreground rounded border px-1.5 py-0.5 font-mono text-[0.85em]">
                Catalog
              </code>
              , send typed notifications across email, WhatsApp, SMS, Telegram, Slack, and Discord.
              Pick your transport: SMTP, Resend, Cloudflare, or your own.
            </p>

            <div
              className="hero-anim mb-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ animationDelay: '160ms' }}
            >
              <a
                href="/docs/get-started/installation"
                onClick={() =>
                  analytics
                    .track('cta')
                    .action('click', { destination: '/docs/get-started/installation' })
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold no-underline transition-colors"
              >
                Get started
                <ArrowRightIcon
                  size={14}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              <a
                href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  analytics
                    .track('github')
                    .action('click', { repo: `${appConfig.git.user}/${appConfig.git.repo}` })
                }
                className="border-border bg-card hover:bg-accent hover:text-foreground text-muted-foreground inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium no-underline transition-colors"
              >
                <GithubLogoIcon size={16} weight="fill" />
                View on GitHub
              </a>
            </div>

            <div
              className="hero-anim mb-8 max-w-[480px] lg:mx-0"
              style={{ animationDelay: '220ms' }}
            >
              <CliPreview />
            </div>

            <div
              className="hero-anim flex flex-col items-center gap-5 lg:items-start"
              style={{ animationDelay: '280ms' }}
            >
              <RuntimeBadges />
              <TrustedBy />
            </div>
          </div>

          <div
            className="hero-anim min-w-0 overflow-hidden rounded-xl border border-bn-slate-200 bg-white shadow-bn-lg dark:border-white/[0.08] dark:bg-[oklch(8%_0.02_260)]"
            style={{ animationDelay: '120ms' }}
          >
            <div className="flex items-center border-b border-bn-slate-200 px-3 py-2 dark:border-white/[0.06]">
              <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActive(tab);
                      analytics.track('snippet').action('change', { tab });
                    }}
                    className={`relative cursor-pointer whitespace-nowrap rounded-md border-0 px-3 py-1.5 font-mono text-[12px] font-medium transition-colors ${
                      active === tab
                        ? 'bg-bn-slate-100 text-bn-slate-800 dark:bg-white/[0.07] dark:text-white/80'
                        : 'bg-transparent text-bn-slate-400 hover:text-bn-slate-600 dark:text-white/30 dark:hover:text-white/50'
                    }`}
                  >
                    {tab}
                    {active === tab && (
                      <span className="absolute bottom-0 left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-full bg-bn-navy-600 dark:bg-bn-navy-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid">
              {tabs.map((tab) => {
                const Tab = snippets[tab];
                const visible = active === tab;
                return (
                  <pre
                    key={tab}
                    className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-bn-slate-700 dark:text-bn-slate-300 md:text-[13px]"
                    style={{
                      gridArea: '1 / 1',
                      opacity: visible ? 1 : 0,
                      transition: 'opacity 200ms var(--ease-out)',
                      pointerEvents: visible ? 'auto' : 'none',
                    }}
                    aria-hidden={!visible}
                  >
                    <Tab />
                  </pre>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
