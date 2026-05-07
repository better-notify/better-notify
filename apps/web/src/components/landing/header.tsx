import { Link, useRouterState } from '@tanstack/react-router';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import {
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  GithubLogoIcon,
  StarIcon,
  ListIcon,
  XLogoIcon,
} from '@phosphor-icons/react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { useState } from 'react';

import { appConfig } from '@/lib/shared';

const navLinks = [
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'Channels', href: '#channels' },
  { label: 'Pipeline', href: '#pipeline' },
  { label: 'Compare', href: '#compare' },
] as const;

export function LandingHeader() {
  const search = useSearchContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === '/';
  const visibleLinks = isHome ? navLinks : navLinks.filter((l) => l.href.startsWith('/'));

  return (
    <header className="sticky top-0 z-30 border-b border-bn-slate-200 bg-[color-mix(in_oklch,var(--background)_88%,transparent)] backdrop-blur-md backdrop-saturate-[1.4] dark:border-bn-slate-800">
      <div className="mx-auto flex max-w-[1200px] items-center gap-8 px-5 py-3 md:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-foreground no-underline"
        >
          <BrandMark size={24} />
          {appConfig.name}

          <span className="bg-bn-navy-50 text-bn-navy-700 border-bn-navy-200 dark:bg-bn-navy-900 dark:text-bn-navy-300 dark:border-bn-navy-700 ml-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none tracking-normal border">
            v{appConfig.version}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {visibleLinks.map((link) => {
            const isActive = link.href.startsWith('/') && pathname.startsWith(link.href);
            return (
              <a
                key={link.label}
                href={link.href}
                className={`text-[13px] font-medium no-underline transition-colors ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {search.enabled && (
            <>
              <button
                onClick={() => search.setOpenSearch(true)}
                className="border-border bg-card text-muted-foreground hover:bg-bn-slate-100 hover:text-foreground dark:hover:bg-bn-slate-800 inline-flex size-[34px] cursor-pointer items-center justify-center rounded-md border transition-colors sm:hidden"
                aria-label="Search docs"
              >
                <MagnifyingGlassIcon size={14} />
              </button>
              <button
                onClick={() => search.setOpenSearch(true)}
                className="border-border hidden cursor-text items-center gap-2 rounded-md border bg-bn-slate-100 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-bn-slate-200 dark:bg-bn-slate-900 dark:hover:bg-bn-slate-800 sm:flex"
                style={{ width: 200 }}
              >
                <MagnifyingGlassIcon size={14} />
                Search docs
                <kbd className="bg-card border-border text-muted-foreground ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
              </button>
            </>
          )}

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="border-border bg-card text-muted-foreground hover:bg-bn-slate-100 hover:text-foreground dark:hover:bg-bn-slate-800 inline-flex size-[34px] cursor-pointer items-center justify-center rounded-md border transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>

          <a
            href={`https://x.com/${appConfig.twitterHandle.replace('@', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-card text-muted-foreground hover:bg-bn-slate-100 hover:text-foreground dark:hover:bg-bn-slate-800 hidden size-[34px] items-center justify-center rounded-md border transition-colors sm:inline-flex"
            aria-label="Follow on X"
          >
            <XLogoIcon size={14} />
          </a>

          <a
            href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-card text-foreground hidden items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium no-underline transition-colors hover:bg-bn-slate-100 dark:hover:bg-bn-slate-800 sm:inline-flex"
          >
            <GithubLogoIcon size={14} />
            GitHub
            <span className="border-border text-muted-foreground ml-0.5 border-l pl-2">
              <StarIcon size={12} weight="fill" className="inline" />
            </span>
          </a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="border-border bg-card text-muted-foreground inline-flex size-[34px] cursor-pointer items-center justify-center rounded-md border transition-colors hover:bg-bn-slate-100 dark:hover:bg-bn-slate-800 md:hidden"
            aria-label="Toggle menu"
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-border flex flex-col gap-1 border-t px-5 py-3 md:hidden">
          {visibleLinks.map((link) => {
            const isActive = link.href.startsWith('/') && pathname.startsWith(link.href);
            return (
              <a
                key={link.label}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors ${
                  isActive
                    ? 'text-foreground bg-bn-slate-100 dark:bg-bn-slate-800'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      )}
    </header>
  );
}

function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="var(--primary)" />
      <g
        stroke="var(--primary-foreground)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <line x1="20" y1="48" x2="20" y2="20" />
        <line x1="20" y1="20" x2="44" y2="48" />
        <line x1="44" y1="48" x2="44" y2="20" />
      </g>
      <circle
        cx="20"
        cy="48"
        r="5"
        className="fill-bn-danger-500"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <g stroke="var(--primary-foreground)" strokeLinecap="round" fill="none" opacity="0.95">
        <path d="M48 18 a4.5 4.5 0 0 1 4.5 -4.5" strokeWidth="2.2" />
        <path d="M48 14 a8.5 8.5 0 0 1 8.5 -8.5" strokeWidth="2.2" opacity="0.7" />
      </g>
    </svg>
  );
}
