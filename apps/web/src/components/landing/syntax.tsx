export const K = ({ children }: { children: React.ReactNode }) => {
  return <span className="font-medium text-bn-navy-700 dark:text-bn-navy-300">{children}</span>;
};

export const F = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="text-[oklch(45%_0.16_290)] dark:text-[oklch(75%_0.13_290)]">{children}</span>
  );
};

export const S = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="text-[oklch(40%_0.14_155)] dark:text-[oklch(75%_0.14_155)]">{children}</span>
  );
};

export const P = ({ children }: { children: React.ReactNode }) => {
  return <span className="text-bn-slate-400 dark:text-bn-slate-500">{children}</span>;
};
