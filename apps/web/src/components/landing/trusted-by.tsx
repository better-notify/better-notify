import type { ReactNode } from 'react';

import { VelozLogo } from '@/components/ui/partners/veloz';

type Company = {
  name: string;
  href: string;
  logo: ReactNode;
};

const companies: Company[] = [
  { name: 'Veloz', href: 'https://onveloz.com', logo: <VelozLogo size={22} /> },
];

export function TrustedBy() {
  return (
    <div className="hero-anim mx-auto max-w-[1200px] px-5 pb-14 [animation-delay:320ms] md:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 max-lg:justify-center">
        <span className="text-muted-foreground/50 text-[15px]">In production at</span>
        {companies.map((c) => (
          <a
            key={c.name}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground flex items-center gap-2.5 text-[15px] font-semibold no-underline opacity-70 transition-opacity hover:opacity-100"
          >
            {c.logo}
            {c.name}
          </a>
        ))}
      </div>
      <a
        href="https://github.com/better-notify/better-notify/issues/new?template=add_your_company.yml"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground/40 mt-2.5 text-[13px] no-underline transition-colors hover:text-muted-foreground max-lg:mx-auto max-lg:block max-lg:w-fit"
      >
        Add yours
      </a>
    </div>
  );
}
