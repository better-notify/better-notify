import { Nodejs, Bun } from '@libs/ui';

export function RuntimeBadges() {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground/40 font-mono text-[11px] uppercase tracking-bn-widest">
        Runs on
      </span>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Nodejs className="h-[15px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/60 font-mono text-[12px]">Node.js</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bun className="h-[18px] w-auto shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground/60 font-mono text-[12px]">Bun</span>
        </div>
      </div>
    </div>
  );
}
