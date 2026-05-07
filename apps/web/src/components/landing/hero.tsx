import { useState } from 'react';
import { ArrowRightIcon, GithubLogoIcon } from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';
import { CliPreview } from '@/components/landing/cli-preview';
import { EmailSnippet } from '@/components/landing/snippets/email';
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

const tabs = ['email.ts', 'telegram.ts', 'cross-transport.ts'] as const;

const snippets = {
  'email.ts': EmailSnippet,
  'telegram.ts': TelegramSnippet,
  'cross-transport.ts': CrossTransportSnippet,
} as const;

export function Hero() {
  const [active, setActive] = useState<(typeof tabs)[number]>('email.ts');

  return (
    <section className="relative">
      <BgGrid />
      <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-14 md:px-8 md:pb-28 md:pt-20 lg:pb-32 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <h1
              className="hero-anim text-foreground mb-6 font-bold tracking-bn-snug text-balance"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', lineHeight: 1.08 }}
            >
              Type-safe notification infrastructure for Node
            </h1>

            <p
              className="hero-anim text-muted-foreground mb-10 max-w-[520px] text-[17px] leading-[1.6] text-pretty lg:mx-0"
              style={{ animationDelay: '80ms' }}
            >
              One{' '}
              <code className="bg-muted text-foreground rounded border px-1.5 py-0.5 font-mono text-[0.85em]">
                Catalog
              </code>{' '}
              drives your typed sender, queue worker, and webhook router across email, SMS, push,
              and Telegram.
            </p>

            <div
              className="hero-anim mb-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ animationDelay: '160ms' }}
            >
              <a
                href="/docs"
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
              className="hero-anim text-muted-foreground/60 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[12px] lg:justify-start"
              style={{ animationDelay: '280ms' }}
            >
              <span>ESM · Node ≥ 22</span>
              <span className="text-muted-foreground/30 hidden sm:inline">|</span>
              <span>MIT licensed</span>
              <span className="text-muted-foreground/30 hidden sm:inline">|</span>
              <span>Standard Schema</span>
            </div>
          </div>

          <div
            className="hero-anim min-w-0 overflow-hidden rounded-xl border border-bn-slate-200 bg-white shadow-bn-lg dark:border-bn-slate-800 dark:bg-bn-slate-950"
            style={{ animationDelay: '120ms' }}
          >
            <div className="flex items-center border-b border-bn-slate-200 px-4 py-2.5 dark:border-bn-slate-800">
              <div className="mr-3 hidden items-center gap-[6px] sm:flex">
                <span className="block size-[10px] rounded-full bg-[#ff5f57]" />
                <span className="block size-[10px] rounded-full bg-[#febc2e]" />
                <span className="block size-[10px] rounded-full bg-[#28c840]" />
              </div>
              <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActive(tab)}
                    className={`cursor-pointer whitespace-nowrap rounded-md border-0 px-3 py-1 font-mono text-[12px] font-medium transition-colors ${
                      active === tab
                        ? 'bg-bn-slate-100 text-bn-slate-800 dark:bg-bn-slate-800 dark:text-bn-slate-200'
                        : 'bg-transparent text-bn-slate-400 hover:text-bn-slate-600 dark:text-bn-slate-500 dark:hover:text-bn-slate-300'
                    }`}
                  >
                    {tab}
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
