import { Envelope, ChatText, Bell, WebhooksLogo } from '@phosphor-icons/react';

import { useInView } from '@/hooks/use-in-view';

const channels = [
  {
    icon: Envelope,
    name: 'Email',
    pkg: '@betternotify/email',
    status: 'ready',
    detail: 'SES · Resend · SMTP · React Email · Mailpit',
  },
  {
    icon: ChatText,
    name: 'SMS',
    pkg: '@betternotify/sms',
    status: 'ready',
    detail: 'Twilio · MessageBird · Vonage',
  },
  {
    icon: Bell,
    name: 'Push',
    pkg: '@betternotify/push',
    status: 'ready',
    detail: 'APNs · FCM · Web Push · Expo',
  },
  {
    icon: WebhooksLogo,
    name: 'Custom',
    pkg: 'defineChannel()',
    status: 'always',
    detail: 'Slack · Discord · Webhooks · in-app',
  },
] as const;

function StatusBadge({ status }: { status: string }) {
  const live = status === 'ready';
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
        live
          ? 'bg-bn-success-100 text-bn-success-700 border-bn-success-300 dark:bg-bn-success-900/30 dark:text-bn-success-300 dark:border-bn-success-700/50'
          : 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {status}
    </span>
  );
}

export function Channels() {
  const [primary, ...rest] = channels;

  const [ref, inView] = useInView();
  return (
    <section id="channels" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">Channels</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Same API. Any channel.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            Each channel is a package with its own slots and transport. Swap providers without
            touching route definitions. Build your own with{' '}
            <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
              defineChannel()
            </code>{' '}
            when the built-ins don't fit.
          </p>
        </div>

        <div className="grid gap-3.5 md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="border-border bg-card md:row-span-2 rounded-lg border p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="bg-primary/10 border-bn-slate-200 dark:border-bn-slate-700 text-primary flex size-[38px] items-center justify-center rounded-lg border">
                <primary.icon size={20} weight="regular" />
              </div>
              <StatusBadge status={primary.status} />
            </div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">{primary.name}</h3>
            <code className="text-muted-foreground mb-3.5 block font-mono text-[11.5px] font-medium">
              {primary.pkg}
            </code>
            <p className="text-muted-foreground mb-4 text-[13.5px] leading-relaxed">
              The first channel shipping in v0.1. Typed templates with React Email, MJML, or plain
              functions. Multi-provider failover out of the box.
            </p>
            <p className="text-muted-foreground m-0 font-mono text-xs leading-relaxed">
              {primary.detail}
            </p>
          </div>

          {rest.map((c) => (
            <div key={c.name} className="border-border bg-card rounded-lg border p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="bg-primary/10 border-bn-slate-200 dark:border-bn-slate-700 text-primary flex size-[38px] items-center justify-center rounded-lg border">
                  <c.icon size={20} weight="regular" />
                </div>
                <StatusBadge status={c.status} />
              </div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">{c.name}</h3>
              <code className="text-muted-foreground mb-3.5 block font-mono text-[11.5px] font-medium">
                {c.pkg}
              </code>
              <p className="text-muted-foreground m-0 font-mono text-xs leading-relaxed">
                {c.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
