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
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground/40 font-mono text-[11px] uppercase tracking-bn-widest">
        In production at
      </span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
        <a
          href="https://github.com/better-notify/better-notify/issues/new?template=add_your_company.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/40 text-[13px] no-underline transition-colors hover:text-muted-foreground"
        >
          Add yours
        </a>
      </div>
    </div>
  );
}
