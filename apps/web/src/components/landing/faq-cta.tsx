import { ArrowRightIcon, GithubLogoIcon } from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';
import { useInView } from '@/hooks/use-in-view';

export function Cta() {
  const [ref, inView, hydrated] = useInView();

  return (
    <section id="cta" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="border-border relative overflow-hidden rounded-2xl border bg-linear-to-b from-white to-bn-slate-100 p-10 dark:from-bn-slate-950 dark:to-bn-slate-900 md:p-12">
          <p className="bn-eyebrow mb-3.5">Open Source</p>
          <h2
            className="text-foreground mb-3.5 max-w-[540px] text-4xl font-bold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Notifications, from your code.
          </h2>
          <p className="text-muted-foreground mb-6 max-w-[520px] text-base leading-relaxed">
            Read the docs, follow the quickstart, ship a typed sender by lunch. MIT licensed; no
            signup; no dashboard.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={appConfig.docs.route}
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-colors"
            >
              Quick start
              <ArrowRightIcon size={14} weight="bold" />
            </a>
            <a
              href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border-strong bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium transition-colors"
            >
              <GithubLogoIcon size={14} />
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
