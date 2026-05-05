import { EnvelopeSimpleIcon, GithubLogoIcon, LinkedinLogoIcon, XLogoIcon } from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';
import { useInView } from '@/hooks/use-in-view';

const author = {
  name: 'Lucas Reis',
  bio: 'A brazilian full stack software engineer focused on developer experience and software quality.',
  photo: '/lucas-reis.png',
  socials: [
    { icon: XLogoIcon, href: 'https://x.com/lucasreis', label: 'X' },
    { icon: GithubLogoIcon, href: 'https://github.com/thereis', label: 'GitHub' },
    {
      icon: LinkedinLogoIcon,
      href: 'https://linkedin.com/in/lucasreismdias',
      label: 'LinkedIn',
    },
  ],
} as const;

const projectSocials = [
  {
    icon: GithubLogoIcon,
    href: `https://github.com/${appConfig.git.user}/${appConfig.git.repo}`,
    label: 'GitHub',
  },
  {
    icon: XLogoIcon,
    href: `https://x.com/${appConfig.twitterHandle.replace('@', '')}`,
    label: 'X',
  },
] as const;

export function Author() {
  const [ref, inView, hydrated] = useInView();

  return (
    <section aria-labelledby="author-name" className="pb-24 md:pb-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="border-border rounded-2xl border bg-linear-to-b from-white to-bn-slate-100 dark:from-bn-slate-950 dark:to-bn-slate-900">
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-1 items-start gap-5 p-8 md:gap-6 md:p-12">
              <img
                src={author.photo}
                alt={`Photo of ${author.name}`}
                className="size-20 shrink-0 rounded-xl object-cover md:size-24"
              />
              <div className="min-w-0">
                <p className="bn-eyebrow mb-1.5">Built by</p>
                <h2
                  id="author-name"
                  className="text-foreground mb-1.5 text-lg font-bold tracking-tight"
                >
                  {author.name}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{author.bio}</p>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Shoutouts, partnerships, or coffee chats:{' '}
                  <a
                    href={`mailto:${appConfig.contactEmail}`}
                    className="text-foreground hover:text-bn-navy-500 dark:hover:text-bn-navy-400 font-medium transition-colors"
                  >
                    <EnvelopeSimpleIcon
                      size={14}
                      aria-hidden="true"
                      className="mr-1 inline-block align-[-2px]"
                    />
                    {appConfig.contactEmail}
                  </a>
                </p>
                <nav aria-label={`${author.name}'s social links`}>
                  <ul className="mt-4 flex list-none flex-wrap items-center gap-1.5 p-0">
                    {author.socials.map((s) => (
                      <li key={s.label}>
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${author.name} on ${s.label}`}
                          className="border-border text-muted-foreground hover:text-foreground hover:bg-bn-slate-100 dark:hover:bg-bn-slate-800 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                        >
                          <s.icon size={14} aria-hidden="true" />
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>

            <div className="border-border flex flex-col justify-center border-t px-8 py-6 md:border-t-0 md:border-l md:px-12 md:py-0">
              <p className="text-foreground mb-1.5 text-sm font-semibold">{appConfig.name}</p>
              <p className="text-muted-foreground mb-3 max-w-[240px] text-[13px] leading-relaxed">
                Type-safe notification infrastructure for Node. Open source, MIT licensed.
              </p>
              <nav aria-label={`${appConfig.name} social links`}>
                <ul className="flex list-none items-center gap-1.5 p-0">
                  {projectSocials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${appConfig.name} on ${s.label}`}
                        className="border-border text-muted-foreground hover:text-foreground hover:bg-bn-slate-100 dark:hover:bg-bn-slate-800 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors"
                      >
                        <s.icon size={14} aria-hidden="true" />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
