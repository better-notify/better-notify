import { createFileRoute } from '@tanstack/react-router';
import { ArrowRightIcon, GithubLogoIcon } from '@phosphor-icons/react';
import { ModelContextProtocol } from '@libs/ui';

import { AnnouncementStrip } from '@/components/landing/announcement-strip';
import { LandingHeader } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { seo } from '@/lib/seo';
import { appConfig } from '@/lib/shared';
import { useInView } from '@/hooks/use-in-view';
import { K, F, S, P, C } from '@/components/landing/syntax';

const packageRepoUrl = `https://github.com/${appConfig.git.user}/${appConfig.git.repo}/tree/main/packages/mcp`;

export const Route = createFileRoute('/mcp')({
  component: McpPage,
  head: () => {
    const url = `${appConfig.baseUrl}/mcp`;
    const description =
      'Turn your notification catalog into MCP tools. Claude, Cursor, and Copilot send emails, SMS, and push notifications through the Model Context Protocol.';
    const { meta, links } = seo({
      title: `MCP Server for Notifications — ${appConfig.name}`,
      description,
      url,
      canonicalUrl: url,
    });
    return {
      meta,
      links,
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebPage',
                '@id': `${url}#webpage`,
                url,
                name: `MCP Server for Notifications — ${appConfig.name}`,
                description,
                inLanguage: appConfig.locale.bcp47,
                isPartOf: { '@id': `${appConfig.baseUrl}#website` },
                primaryImageOfPage: { '@id': `${url}#primaryimage` },
                breadcrumb: { '@id': `${url}#breadcrumb` },
              },
              {
                '@type': 'BreadcrumbList',
                '@id': `${url}#breadcrumb`,
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: appConfig.baseUrl },
                  { '@type': 'ListItem', position: 2, name: 'MCP', item: url },
                ],
              },
              {
                '@type': 'SoftwareApplication',
                '@id': `${url}#software`,
                name: `${appConfig.name} MCP Server`,
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Cross-platform',
                url,
                codeRepository: packageRepoUrl,
                programmingLanguage: 'TypeScript',
                description,
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                },
              },
              {
                '@type': 'FAQPage',
                '@id': `${url}#faq`,
                mainEntity: [
                  {
                    '@type': 'Question',
                    name: 'How do I run the MCP server locally during development?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Start the server with the stdio transport and add it to your AI client config (Claude Code, Cursor, Windsurf). The server runs as a child process and exposes each catalog route as a typed MCP tool.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'How do I deploy the MCP server in production?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Start it with the HTTP transport to deploy as a network service. Authenticate with bearer tokens, API keys, or a custom auth function. Sessions multiplex over a single Streamable HTTP endpoint.',
                    },
                  },
                  {
                    '@type': 'Question',
                    name: 'Can I limit which notification routes AI agents can call?',
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: 'Yes. The expose and deny options accept glob patterns over catalog route IDs, so you can lock agents to transactional routes while keeping marketing routes code-only.',
                    },
                  },
                ],
              },
            ],
          }),
        },
      ],
    };
  },
});

function McpPage() {
  return (
    <>
      <AnnouncementStrip />
      <LandingHeader />
      <main>
        <McpHero />
        <Setup />
        <McpCta />
      </main>
      <Footer />
    </>
  );
}

function McpHero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20 lg:pb-32 lg:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--muted-foreground) 40%, transparent) 1px, transparent 0)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
        }}
      />
      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div>
            <h1
              className="text-foreground mb-5 font-bold tracking-bn-snug"
              style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', lineHeight: 1.08 }}
            >
              MCP server for
              <br />
              notifications.
            </h1>

            <p className="text-muted-foreground mb-8 max-w-[440px] text-[17px] leading-[1.65] text-pretty">
              Each route in your catalog becomes an MCP tool. Claude, Cursor, and Copilot call them
              to send emails, SMS, or push notifications with validated inputs.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/docs/infrastructure/mcp"
                className="bg-primary text-primary-foreground hover:bg-primary/90 group inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold no-underline transition-colors"
              >
                Read the docs
                <ArrowRightIcon
                  size={14}
                  weight="bold"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              <a
                href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}/tree/main/packages/mcp`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-card hover:bg-accent hover:text-foreground text-muted-foreground inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium no-underline transition-colors"
              >
                <GithubLogoIcon size={16} weight="fill" />
                Source
              </a>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-bn-slate-200 bg-white shadow-bn-lg dark:border-white/[0.08] dark:bg-[oklch(8%_0.02_260)]">
            <div className="flex items-center gap-2 border-b border-bn-slate-200 px-4 py-2.5 dark:border-white/[0.06]">
              <span className="font-mono text-[11px] font-medium text-bn-slate-500 dark:text-bn-slate-400">
                mcp-server.ts
              </span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[11.5px] leading-[1.75] text-bn-slate-700 dark:text-bn-slate-300 md:text-[12px]">
              <K>import</K> {'{ '}createNotify, createClient{' }'} <K>from</K>{' '}
              <S>'@betternotify/core'</S>;{'\n'}
              <K>import</K> {'{ '}emailChannel{' }'} <K>from</K>{' '}
              <S>'@betternotify/email'</S>;{'\n'}
              <K>import</K> {'{ '}resendTransport{' }'} <K>from</K>{' '}
              <S>'@betternotify/resend'</S>;{'\n'}
              <K>import</K> {'{ '}createMcpServer{' }'} <K>from</K> <S>'@betternotify/mcp'</S>;
              {'\n'}
              {'\n'}
              <K>const</K> rpc <P>=</P> <F>createNotify</F>(<P>{'{'}</P>
              {'\n'}
              {'  '}channels<P>:</P> {'{ '}email<P>:</P> <F>emailChannel</F>() {'}'}
              <P>,</P>
              {'\n'}
              <P>{'}'}</P>);{'\n'}
              {'\n'}
              <K>const</K> catalog <P>=</P> rpc.<F>catalog</F>(<P>{'{'}</P>
              {'\n'}
              {'  '}welcome<P>,</P> invoice<P>,</P> alert<P>,</P>
              {'\n'}
              <P>{'}'}</P>);{'\n'}
              {'\n'}
              <K>const</K> mcp <P>=</P> <F>createMcpServer</F>(<P>{'{ '}</P>catalog<P>{' }'}</P>);
              {'\n'}
              <K>const</K> mail <P>=</P> <F>createClient</F>(<P>{'{'}</P>
              {'\n'}
              {'  '}catalog<P>,</P>
              {'\n'}
              {'  '}transportsByChannel<P>:</P> {'{ '}email<P>:</P> <F>resendTransport</F>
              (<P>{'{ '}</P>apiKey<P>{' }'}</P>){' }'}
              <P>,</P>
              {'\n'}
              {'  '}plugins<P>:</P> [mcp.<F>plugin</F>()]<P>,</P>
              {'\n'}
              <P>{'}'}</P>);{'\n'}
              {'\n'}
              mcp.<F>connect</F>(mail);{'\n'}
              <K>await</K> mcp.<F>start</F>(<P>{'{ '}</P>type<P>:</P> <S>'stdio'</S>
              <P>{' }'}</P>);
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Setup() {
  const [ref, inView, hydrated] = useInView();

  return (
    <section className="border-border border-y bg-bn-slate-50 py-24 md:py-32 dark:bg-bn-slate-900/50">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="grid items-start gap-16 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="bn-eyebrow mb-3">Setup</p>
            <h2
              className="text-foreground mb-5 text-3xl font-semibold tracking-tight md:text-4xl"
              style={{ lineHeight: 1.1 }}
            >
              Three calls. That's it.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-[480px] text-[17px] leading-relaxed text-pretty">
              Zod schemas convert to JSON Schema for tool discovery. Middleware, hooks, and failover
              run on every agent send, same as programmatic calls.
            </p>

            <div className="border-border bg-card overflow-hidden rounded-xl border">
              <div className="border-b border-bn-slate-200 px-4 py-2.5 dark:border-white/[0.06]">
                <span className="font-mono text-[11px] font-medium text-bn-slate-500 dark:text-bn-slate-400">
                  mcp-server.ts
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75] text-bn-slate-700 dark:text-bn-slate-300 md:text-[13px]">
                <K>import</K> {'{ '}createMcpServer{' }'} <K>from</K> <S>'@betternotify/mcp'</S>;
                {'\n'}
                {'\n'}
                <K>const</K> mcp <P>=</P> <F>createMcpServer</F>
                <P>({'({ '}</P>catalog<P>{' })'}</P>;{'\n'}
                {'\n'}
                <K>const</K> mail <P>=</P> <F>createClient</F>
                <P>({'({'}</P>
                {'\n'}
                {'  '}catalog<P>,</P>
                {'\n'}
                {'  '}transportsByChannel<P>:</P> {'{ '}email<P>:</P> <F>resendTransport</F>
                <P>({'({ '}</P>apiKey<P>{' })'}</P>
                {' }'},{'\n'}
                {'  '}plugins<P>:</P> [mcp.<F>plugin</F>()]<P>,</P>
                {'\n'}
                <P>{'}'}</P>);{'\n'}
                {'\n'}
                mcp.<F>connect</F>(mail);{'\n'}
                <K>await</K> mcp.<F>start</F>
                <P>({'({ '}</P>type<P>:</P> <S>'stdio'</S>
                <P>{' })'}</P>;
              </pre>
            </div>
          </div>

          <div className="flex flex-col gap-10 lg:pt-16">
            <div>
              <h3 className="text-foreground mb-2 text-[15px] font-semibold">stdio for dev</h3>
              <p className="text-muted-foreground mb-4 text-[13.5px] leading-relaxed">
                Add to Claude Code, Cursor, or Windsurf config. The server runs as a child process.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-bn-slate-200 bg-bn-slate-100 px-4 py-3 font-mono text-[11px] leading-relaxed text-bn-slate-600 dark:border-bn-slate-800 dark:bg-bn-slate-950 dark:text-bn-slate-400">
                {'{\n'}
                {'  '}
                <S>"mcpServers"</S>
                <P>:</P> {'{\n'}
                {'    '}
                <S>"betternotify"</S>
                <P>:</P> {'{\n'}
                {'      '}
                <S>"command"</S>
                <P>:</P> <S>"npx"</S>
                <P>,</P>
                {'\n'}
                {'      '}
                <S>"args"</S>
                <P>:</P> [<S>"tsx"</S>
                <P>,</P> <S>"mcp-server.ts"</S>]{'\n'}
                {'    '}
                {'}\n'}
                {'  '}
                {'}\n'}
                {'}'}
              </pre>
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-[15px] font-semibold">HTTP for prod</h3>
              <p className="text-muted-foreground mb-4 text-[13.5px] leading-relaxed">
                Deploy as a network service. Bearer token, API key, or custom auth. Sessions
                multiplex over a single endpoint.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-bn-slate-200 bg-bn-slate-100 px-4 py-3 font-mono text-[12px] leading-relaxed text-bn-slate-700 dark:border-bn-slate-800 dark:bg-bn-slate-950 dark:text-bn-slate-300">
                <K>await</K> mcp.<F>start</F>
                <P>({'({'}</P>
                {'\n'}
                {'  '}type<P>:</P> <S>'http'</S>
                <P>,</P>
                {'\n'}
                {'  '}port<P>:</P> 3100<P>,</P>
                {'\n'}
                {'  '}authenticate<P>:</P> <F>bearerAuth</F>(secret)<P>,</P>
                {'\n'}
                <P>{'}'}</P>);
              </pre>
            </div>

            <div>
              <h3 className="text-foreground mb-2 text-[15px] font-semibold">Route filtering</h3>
              <p className="text-muted-foreground text-[13.5px] leading-relaxed">
                <code className="bg-muted rounded border px-1 py-0.5 font-mono text-[0.85em]">
                  expose
                </code>{' '}
                and{' '}
                <code className="bg-muted rounded border px-1 py-0.5 font-mono text-[0.85em]">
                  deny
                </code>{' '}
                accept glob patterns. Lock agents to transactional routes; keep marketing routes
                code-only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function McpCta() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[480px]">
            <h2
              className="text-foreground mb-2 text-2xl font-bold tracking-tight md:text-3xl"
              style={{ lineHeight: 1.15 }}
            >
              Let your agents send notifications.
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              One package. Works with any MCP client. Add{' '}
              <code className="bg-muted rounded border px-1 py-0.5 font-mono text-[0.85em]">
                @betternotify/mcp
              </code>{' '}
              and start the server.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <a
              href="/docs/infrastructure/mcp"
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-medium transition-colors"
            >
              Get started
              <ArrowRightIcon size={14} weight="bold" />
            </a>
            <a
              href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}/tree/main/examples/mcp-server`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border-strong bg-card hover:bg-accent inline-flex items-center gap-2 rounded-md border px-5 py-3 text-sm font-medium transition-colors"
            >
              <GithubLogoIcon size={14} />
              View example
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
