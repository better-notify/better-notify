import {
  Envelope,
  ChatText,
  Bell,
  TelegramLogo,
  DiscordLogo,
  SlackLogo,
  WhatsappLogo,
  Lightning,
  WebhooksLogo,
} from '@phosphor-icons/react';

import { useInView } from '@/hooks/use-in-view';

const channels = [
  {
    icon: Envelope,
    name: 'Email',
    pkg: '@betternotify/email',
    status: 'ready',
    detail: 'Resend · Cloudflare · SMTP · Mailchimp · React Email',
    featured: false,
  },
  {
    icon: WhatsappLogo,
    name: 'WhatsApp',
    pkg: '@betternotify/whatsapp',
    status: 'new',
    detail: 'Meta Cloud API · Text · Media · Templates · Interactive',
    featured: true,
  },
  {
    icon: ChatText,
    name: 'SMS',
    pkg: '@betternotify/sms',
    status: 'ready',
    detail: 'Twilio',
    featured: false,
  },
  {
    icon: Bell,
    name: 'Push',
    pkg: '@betternotify/push',
    status: 'soon',
    detail: 'APNs · FCM · Web Push',
    featured: false,
  },
  {
    icon: TelegramLogo,
    name: 'Telegram',
    pkg: '@betternotify/telegram',
    status: 'ready',
    detail: 'Bot API · Text · Photos · Documents',
    featured: false,
  },
  {
    icon: DiscordLogo,
    name: 'Discord',
    pkg: '@betternotify/discord',
    status: 'ready',
    detail: 'Webhook API · Embeds · Username override',
    featured: false,
  },
  {
    icon: SlackLogo,
    name: 'Slack',
    pkg: '@betternotify/slack',
    status: 'ready',
    detail: 'Bot API · Block Kit · Threads',
    featured: false,
  },
  {
    icon: Lightning,
    name: 'Zapier',
    pkg: '@betternotify/zapier',
    status: 'ready',
    detail: 'Webhooks · Automations · 7000+ apps',
    featured: false,
  },
  {
    icon: WebhooksLogo,
    name: 'Custom',
    pkg: 'defineChannel()',
    status: 'always',
    detail: 'Webhooks · in-app',
    featured: false,
  },
] as const;

function StatusBadge({ status }: { status: string }) {
  const isNew = status === 'new';
  const live = status === 'ready' || isNew;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
        isNew
          ? 'bg-[oklch(92%_0.05_155)] text-[oklch(35%_0.15_155)] border-[oklch(80%_0.1_155)] dark:bg-[oklch(25%_0.06_155)] dark:text-[oklch(78%_0.14_155)] dark:border-[oklch(40%_0.1_155)] animate-pulse'
          : live
            ? 'bg-bn-success-100 text-bn-success-700 border-bn-success-300 dark:bg-bn-success-900/30 dark:text-bn-success-300 dark:border-bn-success-700/50'
            : 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {isNew ? 'new' : status}
    </span>
  );
}

export function Channels() {
  const [primary, featured, ...rest] = channels;

  const [ref, inView, hydrated] = useInView();
  return (
    <section id="channels" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
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
            Each channel is a package with its own rendering and transport. Swap providers without
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
              Typed templates with React Email, MJML, or plain functions. Multi-provider failover
              out of the box.
            </p>
            <p className="text-muted-foreground m-0 font-mono text-xs leading-relaxed">
              {primary.detail}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[oklch(78%_0.12_155)] bg-[oklch(98%_0.01_155)] p-5 dark:border-[oklch(38%_0.08_155)] dark:bg-[oklch(16%_0.02_155)] md:col-span-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, oklch(50% 0.15 155) 0.5px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex size-[38px] items-center justify-center rounded-lg border border-[oklch(78%_0.12_155)] bg-[oklch(92%_0.06_155)] text-[oklch(45%_0.15_155)] dark:border-[oklch(38%_0.08_155)] dark:bg-[oklch(25%_0.06_155)] dark:text-[oklch(75%_0.14_155)]">
                  <featured.icon size={20} weight="fill" />
                </div>
                <StatusBadge status={featured.status} />
              </div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">{featured.name}</h3>
              <code className="text-muted-foreground mb-3.5 block font-mono text-[11.5px] font-medium">
                {featured.pkg}
              </code>
              <p className="text-muted-foreground mb-4 text-[13.5px] leading-relaxed">
                Send text, media, templates, and interactive messages through Meta Cloud API. Same
                builder and pipeline as every other channel.
              </p>
              <p className="text-muted-foreground m-0 font-mono text-xs leading-relaxed">
                {featured.detail}
              </p>
            </div>
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
