import { GithubLogoIcon, XLogoIcon } from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';

const navColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Channels', href: '#channels' },
      { label: 'Pipeline', href: '#pipeline' },
      { label: 'Compare', href: '#compare' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Quick start', href: '/docs' },
      {
        label: 'GitHub',
        href: `https://github.com/${appConfig.git.user}/${appConfig.git.repo}`,
        external: true,
      },
      { label: 'npm', href: `https://www.npmjs.com/org/betternotify`, external: true },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto max-w-[1200px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="text-foreground mb-2 text-sm font-semibold tracking-tight">
              {appConfig.name}
            </p>
            <p className="text-muted-foreground max-w-[280px] text-[13px] leading-relaxed">
              Type-safe notification infrastructure for Node. Open source, MIT licensed.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={`https://github.com/${appConfig.git.user}/${appConfig.git.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] no-underline transition-colors"
                aria-label="GitHub"
              >
                <GithubLogoIcon size={16} />
              </a>
              <a
                href={`https://x.com/${appConfig.twitterHandle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] no-underline transition-colors"
                aria-label="X (Twitter)"
              >
                <XLogoIcon size={16} />
              </a>
            </div>
          </div>

          {navColumns.map((col) => (
            <div key={col.title}>
              <p className="text-foreground mb-3 text-[13px] font-semibold">{col.title}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground text-[13px] no-underline transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith('/') ? (
                      <a
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-[13px] no-underline transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <a
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-[13px] no-underline transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-10 border-t pt-6">
          <p className="text-muted-foreground/60 text-[12px]">
            &copy; {new Date().getFullYear()} {appConfig.name}. MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
