import { Link } from '@tanstack/react-router';
import { ArrowRight } from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';
import { useInView } from '@/hooks/use-in-view';

export function Cta() {
  const [ref, inView, hydrated] = useInView();
  return (
    <section id="cta" className="py-24 md:py-28">
      <div ref={ref} className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}>
        <div className="border-border relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white to-bn-slate-100 p-10 dark:from-bn-slate-950 dark:to-bn-slate-900 md:p-12">
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
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-colors"
            >
              Quick start
              <ArrowRight size={14} weight="bold" />
            </Link>
            <a
              href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border-strong bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
