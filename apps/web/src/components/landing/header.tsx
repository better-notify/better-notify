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
  CopyIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { useTheme } from 'fumadocs-ui/provider/base';
import type { MouseEvent, ReactNode } from 'react';
import { useRef, useEffect, useState } from 'react';
import { useAnalytics } from '@/hooks/use-analytics';
import { useStarCount, formatStarCount } from '@/hooks/use-star-count';

import { LogoShort } from '@libs/ui';
import { appConfig } from '@/lib/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { logoSvg, wordmarkSvg } from '@/lib/brand-assets';

const navLinks = [
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'Changelog', href: '/docs/changelog' },
] as const;

const writeClipboardText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-999px';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

const downloadBrandAssets = () => {
  const link = document.createElement('a');
  link.href = '/brand-assets.zip';
  link.download = 'better-notify-brand-assets.zip';
  document.body.append(link);
  link.click();
  link.remove();
};

function BrandAssetAction({
  children,
  icon,
  onSelect,
}: {
  children: ReactNode;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-bn-slate-100 focus-visible:bg-bn-slate-100 focus-visible:outline-none dark:hover:bg-bn-slate-800 dark:focus-visible:bg-bn-slate-800"
    >
      <span className="border-border bg-card text-muted-foreground group-hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function LandingHeader() {
  const search = useSearchContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const analytics = useAnalytics('header');
  const starCount = useStarCount(appConfig.git.user, appConfig.git.repo);
  const isDark = resolvedTheme === 'dark';
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === '/';
  const visibleLinks = isHome ? navLinks : navLinks.filter((l) => l.href.startsWith('/'));

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty('--landing-header-height', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleBrandContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    setBrandMenuOpen(true);
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b border-bn-slate-200 bg-[color-mix(in_oklch,var(--background)_88%,transparent)] backdrop-blur-md backdrop-saturate-[1.4] dark:border-bn-slate-800"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-8 px-5 py-3 md:px-8">
        <Popover
          open={brandMenuOpen}
          onOpenChange={(open) => setBrandMenuOpen(open)}
          triggerId="brand-assets-trigger"
        >
          <PopoverTrigger
            id="brand-assets-trigger"
            nativeButton={false}
            onClick={(event) => event.preventBaseUIHandler()}
            onContextMenu={handleBrandContextMenu}
            render={
              <span className="inline-flex">
                <Link
                  to="/"
                  className="flex items-center gap-2.5 rounded-md text-base font-bold tracking-tight text-foreground no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <LogoShort className="size-6" />
                  {appConfig.name}
                </Link>
              </span>
            }
          />
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={16}
            className="w-64 gap-1 rounded-md p-1.5 shadow-lg ring-1 ring-foreground/10"
          >
            <BrandAssetAction
              icon={<CopyIcon />}
              onSelect={() => {
                void writeClipboardText(logoSvg);
                setBrandMenuOpen(false);
                analytics.track('brand_assets').action('export', { asset: 'logo_svg' });
              }}
            >
              Copy logo as SVG
            </BrandAssetAction>
            <BrandAssetAction
              icon={<CopyIcon />}
              onSelect={() => {
                void writeClipboardText(wordmarkSvg);
                setBrandMenuOpen(false);
                analytics.track('brand_assets').action('export', { asset: 'wordmark_svg' });
              }}
            >
              Copy wordmark as SVG
            </BrandAssetAction>
            <BrandAssetAction
              icon={<DownloadSimpleIcon />}
              onSelect={() => {
                downloadBrandAssets();
                setBrandMenuOpen(false);
                analytics.track('brand_assets').action('export', { asset: 'brand_assets_zip' });
              }}
            >
              Download brand assets
            </BrandAssetAction>
          </PopoverContent>
        </Popover>

        <nav className="hidden items-center gap-5 md:flex">
          {visibleLinks.map((link) => {
            const isActive =
              link.href.startsWith('/') &&
              pathname.startsWith(link.href) &&
              !navLinks.some(
                (other) =>
                  other.href !== link.href &&
                  other.href.startsWith(link.href) &&
                  pathname.startsWith(other.href),
              );
            return (
              <a
                key={link.label}
                href={link.href}
                className={`text-[13px] font-medium no-underline transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
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
                onClick={() => {
                  search.setOpenSearch(true);
                  analytics.track('search').action('open', { trigger: 'mobile_icon' });
                }}
                className="border-border bg-card text-muted-foreground hover:bg-bn-slate-100 hover:text-foreground dark:hover:bg-bn-slate-800 inline-flex size-[34px] cursor-pointer items-center justify-center rounded-md border transition-colors sm:hidden"
                aria-label="Search docs"
              >
                <MagnifyingGlassIcon size={14} />
              </button>
              <button
                onClick={() => {
                  search.setOpenSearch(true);
                  analytics.track('search').action('open', { trigger: 'search_bar' });
                }}
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
            {(starCount.count != null || starCount.isLoading) && (
              <span className="border-border text-muted-foreground ml-0.5 flex items-center gap-1 border-l pl-2">
                <StarIcon size={12} weight="fill" className="inline" />
                {starCount.count != null ? (
                  formatStarCount(starCount.count)
                ) : (
                  <span className="inline-block h-3.5 w-6 animate-pulse rounded-sm bg-bn-slate-200 dark:bg-bn-slate-700" />
                )}
              </span>
            )}
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
            const isActive =
              link.href.startsWith('/') &&
              pathname.startsWith(link.href) &&
              !navLinks.some(
                (other) =>
                  other.href !== link.href &&
                  other.href.startsWith(link.href) &&
                  pathname.startsWith(other.href),
              );
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
