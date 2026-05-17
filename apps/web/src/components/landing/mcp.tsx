import { ArrowRightIcon } from '@phosphor-icons/react';
import { ModelContextProtocol } from '@libs/ui';

import { useInView } from '@/hooks/use-in-view';
import { K, F, S, P, C } from '@/components/landing/syntax';

function CatalogCode() {
  return (
    <pre className="m-0 overflow-x-auto font-mono text-[12px] leading-[1.7] text-bn-slate-700 dark:text-bn-slate-300 md:text-[12.5px]">
      <C>// your catalog — same as always</C>
      {'\n'}
      <K>const</K> catalog <P>=</P> rpc.<F>catalog</F>
      <P>({'({'}</P>
      {'\n'}
      {'  '}transactional<P>:</P> rpc.<F>catalog</F>
      <P>({'({'}</P>
      {'\n'}
      {'    '}welcome<P>:</P> rpc{'\n'}
      {'      '}.<F>email</F>(){'\n'}
      {'      '}.<F>input</F>(z.<F>object</F>
      <P>({'({'}</P> name<P>:</P> z.<F>string</F>() <P>{'}'}</P>)){'\n'}
      {'      '}.<F>subject</F>(<S>{`'Welcome!'`}</S>){'\n'}
      {'      '}.<F>template</F>(WelcomeEmail)<P>,</P>
      {'\n'}
      {'  '}
      <P>{'}'}</P>)<P>,</P>
      {'\n'}
      <P>{'}'}</P>);
    </pre>
  );
}

function AgentView() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <span className="flex size-5 items-center justify-center rounded bg-[oklch(92%_0.04_258)] dark:bg-[oklch(25%_0.04_258)]">
          <ModelContextProtocol
            width={11}
            height={11}
            className="fill-bn-navy-700 dark:fill-bn-navy-300"
          />
        </span>
        <span className="font-mono text-[11.5px] font-medium text-bn-slate-600 dark:text-bn-slate-300">
          tools/list
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <ToolRow
          name="transactional.welcome.send"
          desc="Send email notification via welcome"
          accent
        />
        <ToolRow
          name="transactional.welcome.render"
          desc="Preview email notification for welcome without sending"
        />
      </div>

      <div className="mt-1 flex items-center gap-2 rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <span className="flex size-5 items-center justify-center rounded bg-[oklch(92%_0.04_258)] dark:bg-[oklch(25%_0.04_258)]">
          <svg
            width={11}
            height={11}
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-bn-navy-700 dark:text-bn-navy-300"
          >
            <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm4 1a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1zm4 0a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z" />
          </svg>
        </span>
        <span className="font-mono text-[11.5px] font-medium text-bn-slate-600 dark:text-bn-slate-300">
          resources
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <ResourceRow uri="notifications://recent" />
        <ResourceRow uri="notifications://stats" />
      </div>
    </div>
  );
}

function ToolRow({ name, desc, accent }: { name: string; desc: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-md border px-3 py-2.5 ${
        accent
          ? 'border-bn-navy-200 bg-bn-navy-50 dark:border-bn-navy-800/60 dark:bg-bn-navy-950/40'
          : 'border-bn-slate-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-[oklch(60%_0.18_155)]" />
        <code className="text-[11.5px] font-semibold text-bn-slate-800 dark:text-bn-slate-200">
          {name}
        </code>
      </div>
      <p className="m-0 mt-1 pl-3.5 text-[11px] leading-snug text-bn-slate-500 dark:text-bn-slate-400">
        {desc}
      </p>
    </div>
  );
}

function ResourceRow({ uri }: { uri: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-bn-slate-200 bg-white px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <span className="inline-block size-1.5 rounded-full bg-bn-slate-300 dark:bg-bn-slate-600" />
      <code className="text-[11px] text-bn-slate-600 dark:text-bn-slate-400">{uri}</code>
    </div>
  );
}

export function Mcp() {
  const [ref, inView, hydrated] = useInView();

  return (
    <section id="mcp" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">AI-native</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Your catalog is their toolbox.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            Expose your notification routes as MCP tools. Claude, Cursor, Copilot — any agent that
            speaks the{' '}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Model Context Protocol
            </a>{' '}
            can discover and send notifications through your typed catalog.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="flex items-center gap-2 border-b border-bn-slate-200 px-4 py-2.5 dark:border-white/[0.06]">
              <span className="size-2.5 rounded-full bg-[oklch(70%_0.01_260)] opacity-60" />
              <span className="size-2.5 rounded-full bg-[oklch(70%_0.01_260)] opacity-60" />
              <span className="size-2.5 rounded-full bg-[oklch(70%_0.01_260)] opacity-60" />
              <span className="ml-2 font-mono text-[11px] text-bn-slate-400 dark:text-bn-slate-500">
                catalog.ts
              </span>
            </div>
            <div className="p-5">
              <CatalogCode />
            </div>
          </div>

          <div className="border-border bg-card overflow-hidden rounded-xl border">
            <div className="flex items-center gap-2 border-b border-bn-slate-200 px-4 py-2.5 dark:border-white/[0.06]">
              <ModelContextProtocol
                width={13}
                height={13}
                className="fill-bn-slate-500 dark:fill-bn-slate-400"
              />
              <span className="font-mono text-[11px] text-bn-slate-400 dark:text-bn-slate-500">
                what AI agents see
              </span>
            </div>
            <div className="p-5">
              <AgentView />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="border-border bg-card rounded-lg border p-4">
            <h3 className="text-foreground mb-1.5 text-sm font-semibold">Zero config discovery</h3>
            <p className="text-muted-foreground m-0 text-[13px] leading-relaxed">
              Each catalog route becomes a typed tool. Input schemas, descriptions, and validation —
              automatic.
            </p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4">
            <h3 className="text-foreground mb-1.5 text-sm font-semibold">
              Same pipeline, new caller
            </h3>
            <p className="text-muted-foreground m-0 text-[13px] leading-relaxed">
              Middleware, hooks, failover — all active. Agent sends go through the exact same
              execution path.
            </p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4">
            <h3 className="text-foreground mb-1.5 text-sm font-semibold">stdio or HTTP</h3>
            <p className="text-muted-foreground m-0 text-[13px] leading-relaxed">
              Run locally as a subprocess or deploy as a network service with bearer auth and
              streaming.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <a
            href="/mcp"
            className="text-primary hover:text-primary/80 group inline-flex items-center gap-1.5 text-[14px] font-medium no-underline transition-colors"
          >
            Learn more about the MCP server
            <ArrowRightIcon
              size={14}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
