import { Nodejs, Bun, CloudflareWorkers, Vercel } from '@libs/ui';

export function RuntimeBadges() {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground/80 font-mono text-[11px] uppercase tracking-bn-widest">
        Runs on
      </span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <Nodejs className="h-[15px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/80 font-mono text-[12px]">Node.js</span>
        </div>
        <span className="text-muted-foreground/80 text-[12px] leading-none">·</span>
        <div className="flex items-center gap-1.5">
          <Bun className="h-[18px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/80 font-mono text-[12px]">Bun</span>
        </div>
        <span className="text-muted-foreground/80 text-[12px] leading-none">·</span>
        <div className="flex items-center gap-2">
          <CloudflareWorkers className="h-[16px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/80 font-mono text-[12px]">Cloudflare Workers</span>
        </div>
        <span className="text-muted-foreground/80 text-[12px] leading-none">·</span>
        <div className="flex items-center gap-2">
          <Vercel className="h-[14px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/80 font-mono text-[12px]">Vercel</span>
        </div>
      </div>
    </div>
  );
}
