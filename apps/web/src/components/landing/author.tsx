import { Link } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CalendarIcon,
  EnvelopeSimpleIcon,
  GithubLogoIcon,
  LinkedinLogoIcon,
  XLogoIcon,
} from '@phosphor-icons/react';

import { appConfig } from '@/lib/shared';
import { useInView } from '@/hooks/use-in-view';

type BlogPreviewPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string | null;
  tags: string[];
};

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

export function BlogAndAuthor({ posts }: { posts: BlogPreviewPost[] }) {
  const [ref, inView, hydrated] = useInView();

  return (
    <section aria-labelledby="author-name" className="pb-24 md:pb-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="border-border rounded-2xl border bg-linear-to-b from-white to-bn-slate-100 dark:from-bn-slate-950 dark:to-bn-slate-900">
          <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_340px]">
            <div className="flex flex-col gap-3 p-8 md:p-12">
              <div className="mb-1 flex items-center justify-between">
                <p className="bn-eyebrow">Latest from the blog</p>
                <Link
                  to="/blog"
                  className="text-primary flex items-center gap-1 text-[13px] font-medium no-underline transition-opacity hover:opacity-80"
                >
                  View all
                  <ArrowRightIcon size={12} weight="bold" />
                </Link>
              </div>

              {posts.map((post) => (
                <Link
                  key={post.slug}
                  to="/blog/$slug"
                  params={{ slug: post.slug }}
                  className="border-border group rounded-lg border bg-white/60 p-4 no-underline transition-colors hover:bg-white/90 dark:bg-bn-slate-900/40 dark:hover:bg-bn-slate-900/70"
                >
                  <div className="mb-2 flex items-center justify-between">
                    {post.category && (
                      <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-[10px] font-medium capitalize">
                        {post.category}
                      </span>
                    )}
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <CalendarIcon size={11} />
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </span>
                  </div>
                  <h3 className="text-foreground group-hover:text-primary mb-1 text-sm font-semibold tracking-bn-snug transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-[13px] leading-relaxed line-clamp-2">
                    {post.description}
                  </p>
                  {post.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[9px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            <div className="border-border border-t md:border-t-0 md:border-l" />

            <div className="flex flex-col justify-center px-8 py-6 md:px-12 md:py-8">
              <div className="flex flex-col items-center text-center">
                <img
                  src={author.photo}
                  alt={`Photo of ${author.name}`}
                  className="mb-4 size-20 rounded-xl object-cover"
                />
                <p className="bn-eyebrow mb-1.5">Crafted by</p>
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
                  <ul className="mt-4 flex list-none flex-wrap items-center justify-center gap-1.5 p-0">
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

              <div className="border-border mt-6 border-t pt-5 text-center md:mt-8">
                <p className="text-foreground mb-1.5 text-sm font-semibold">{appConfig.name}</p>
                <p className="text-muted-foreground mb-3 text-[13px] leading-relaxed">
                  Type-safe notification infrastructure for Node. Open source, MIT licensed.
                </p>
                <nav aria-label={`${appConfig.name} social links`}>
                  <ul className="flex list-none items-center justify-center gap-1.5 p-0">
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
      </div>
    </section>
  );
}
