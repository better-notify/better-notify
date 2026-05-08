'use client';

import { useState } from 'react';

const managers = [
  { id: 'npm', label: 'npm', cmd: (pkg: string) => `npm install ${pkg}` },
  { id: 'pnpm', label: 'pnpm', cmd: (pkg: string) => `pnpm add ${pkg}` },
  { id: 'yarn', label: 'yarn', cmd: (pkg: string) => `yarn add ${pkg}` },
  { id: 'bun', label: 'bun', cmd: (pkg: string) => `bun add ${pkg}` },
] as const;

export const PackageInstall = ({ pkg }: { pkg: string }) => {
  const [active, setActive] = useState<string>('npm');
  const current = managers.find((m) => m.id === active) ?? managers[0];

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex border-b border-border bg-fd-muted">
        {managers.map((m) => (
          <button
            key={m.id}
            onClick={() => setActive(m.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              m.id === active
                ? 'text-foreground border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-sm">
        <code>{current.cmd(pkg)}</code>
      </pre>
    </div>
  );
};
