import {
  StackIcon,
  GitForkIcon,
  FunnelIcon,
  PulseIcon,
  ShieldIcon,
  LightningIcon,
} from '@phosphor-icons/react';

import { useInView } from '@/hooks/use-in-view';
import { K, F, P } from '@/components/landing/syntax';

const anchor = {
  icon: StackIcon,
  title: 'End-to-end typed',
  body: 'One catalog type drives your sender, queue worker, and webhook router. Refactor a route and every call site updates.',
} as const;

const supporting = [
  {
    icon: GitForkIcon,
    title: 'Channel-agnostic',
    body: 'Email, SMS, push, or your own channel. Same pipeline, different transport.',
  },
  {
    icon: FunnelIcon,
    title: 'Composable middleware',
    body: 'Rate limit, retry, dedupe, log. Wrap any send with the same primitives.',
  },
  {
    icon: PulseIcon,
    title: 'Provider failover',
    body: 'multiTransport tries SES, then Resend, then SMTP. Health-checked, retry-aware.',
  },
  {
    icon: ShieldIcon,
    title: 'Schema-first inputs',
    body: 'Zod, Valibot, or any Standard Schema. Validated before any side effect.',
  },
  {
    icon: LightningIcon,
    title: 'Plays well with everything',
    body: 'Express, Hono, tRPC, queue workers. ESM-only, Node 22+, zero opinions.',
  },
] as const;

export function Features() {
  const [ref, inView] = useInView();
  return (
    <section id="features" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">Why Better-Notify</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            A library, not a platform.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            No dashboard, no SaaS, no vendor lock-in. Define notifications in code and let the type
            system catch the rest.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="border-border bg-card rounded-lg border p-6">
            <div className="bg-primary/10 border-bn-slate-200 dark:border-bn-slate-700 text-primary mb-3 flex size-10 items-center justify-center rounded-lg border">
              <anchor.icon size={20} weight="regular" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold tracking-bn-snug">
              {anchor.title}
            </h3>
            <p className="text-muted-foreground mb-4 text-[15px] leading-relaxed text-pretty">
              {anchor.body}
            </p>
            <div className="rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3.5 py-2.5 font-mono text-xs text-bn-slate-700 dark:border-bn-slate-800 dark:bg-bn-slate-950 dark:text-bn-slate-300">
              <K>const</K> catalog <P>=</P> rpc.<F>catalog</F>
              <P>({'({ '}</P>welcome<P>,</P> invoice<P>,</P> alert<P>{' })'}</P>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {supporting.slice(0, 2).map((f) => (
              <div
                key={f.title}
                className="border-border bg-card flex flex-1 items-start gap-3 rounded-lg border p-4"
              >
                <div className="bg-primary/10 border-bn-slate-200 dark:border-bn-slate-700 text-primary flex size-8 shrink-0 items-center justify-center rounded-md border">
                  <f.icon size={15} weight="regular" />
                </div>
                <div>
                  <h3 className="text-foreground text-sm font-semibold tracking-bn-snug">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {supporting.slice(2).map((f) => (
            <div
              key={f.title}
              className="border-border bg-card flex items-start gap-3 rounded-lg border p-4"
            >
              <div className="bg-primary/10 border-bn-slate-200 dark:border-bn-slate-700 text-primary flex size-8 shrink-0 items-center justify-center rounded-md border">
                <f.icon size={15} weight="regular" />
              </div>
              <div>
                <h3 className="text-foreground text-sm font-semibold tracking-bn-snug">
                  {f.title}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-[13px] leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
