'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

export type RateLimitDemoProps = {
  max?: number;
  windowMs?: number;
};

type Attempt = { id: number; status: 'ok' | 'blocked'; timestamp: number };

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const palette = {
  light: {
    node: 'oklch(96% 0.004 75)',
    nodeBorder: 'oklch(78% 0.012 75)',
    text: 'oklch(35% 0.01 75)',
    textMuted: 'oklch(55% 0.01 75)',
    success: 'oklch(62% 0.19 155)',
    successBg: 'oklch(95% 0.04 155)',
    failure: 'oklch(58% 0.2 27)',
    failureBg: 'oklch(95% 0.04 27)',
    controlBg: 'oklch(94% 0.005 75)',
    controlBorder: 'oklch(85% 0.008 75)',
    controlActive: 'oklch(74% 0.16 75)',
    controlText: 'oklch(40% 0.01 75)',
    barBg: 'oklch(92% 0.005 75)',
    barFill: 'oklch(74% 0.16 75)',
    barWarn: 'oklch(70% 0.17 55)',
    barDanger: 'oklch(58% 0.2 27)',
  },
  dark: {
    node: 'oklch(20% 0.006 75)',
    nodeBorder: 'oklch(36% 0.01 75)',
    text: 'oklch(82% 0.008 75)',
    textMuted: 'oklch(55% 0.01 75)',
    success: 'oklch(70% 0.18 155)',
    successBg: 'oklch(25% 0.06 155)',
    failure: 'oklch(65% 0.2 27)',
    failureBg: 'oklch(22% 0.06 27)',
    controlBg: 'oklch(20% 0.006 75)',
    controlBorder: 'oklch(32% 0.008 75)',
    controlActive: 'oklch(78% 0.16 75)',
    controlText: 'oklch(75% 0.008 75)',
    barBg: 'oklch(25% 0.006 75)',
    barFill: 'oklch(78% 0.16 75)',
    barWarn: 'oklch(75% 0.17 55)',
    barDanger: 'oklch(65% 0.2 27)',
  },
} as const;

export function RateLimitDemo({ max = 3, windowMs = 6000 }: RateLimitDemoProps) {
  const dark = useTheme();
  const c = dark ? palette.dark : palette.light;

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'blocked' | null>(null);
  const nextId = useRef(0);
  const rafRef = useRef<number>(0);

  const currentCount = attempts.filter((a) => a.status === 'ok').length;
  const isLimited = currentCount >= max;

  useEffect(() => {
    if (windowStart === null) return;

    const tick = () => {
      const elapsed = Date.now() - windowStart;
      const pct = Math.min(elapsed / windowMs, 1);
      setProgress(pct);

      if (pct >= 1) {
        setWindowStart(null);
        setProgress(1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [windowStart, windowMs]);

  const windowExpired = windowStart !== null && progress >= 1;

  const handleSend = useCallback(() => {
    const now = Date.now();

    if (windowStart === null || windowExpired) {
      setWindowStart(now);
      setAttempts([{ id: nextId.current++, status: 'ok', timestamp: now }]);
      setProgress(0);
      setFlash('ok');
      setTimeout(() => setFlash(null), 400);
      return;
    }

    const status = isLimited ? 'blocked' : 'ok';
    setAttempts((prev) => [...prev, { id: nextId.current++, status, timestamp: now }]);
    setFlash(status);
    setTimeout(() => setFlash(null), 400);
  }, [isLimited, windowStart, windowExpired]);

  const barColor = () => {
    if (isLimited) return c.barDanger;
    if (currentCount >= max - 1) return c.barWarn;
    return c.barFill;
  };

  return (
    <div className="not-prose">
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: c.nodeBorder,
          background: dark ? 'oklch(16% 0.004 75)' : 'oklch(98% 0.003 75)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span style={{ color: c.text }} className="font-mono text-sm font-semibold">
              {currentCount} / {max}
            </span>
            <span style={{ color: c.textMuted }} className="font-mono text-xs">
              sends this window
            </span>
          </div>
          {isLimited && (
            <span
              className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest"
              style={{
                background: c.failureBg,
                color: c.failure,
                border: `1px solid ${c.failure}40`,
              }}
            >
              rate limited
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: c.barBg }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: barColor(),
                transition: 'background 300ms',
              }}
            />
          </div>
          <div className="mt-1 flex justify-between">
            <span style={{ color: c.textMuted }} className="font-mono text-[10px]">
              window: {(windowMs / 1000).toFixed(0)}s
            </span>
            {windowStart !== null && (
              <span style={{ color: c.textMuted }} className="font-mono text-[10px]">
                {(((1 - progress) * windowMs) / 1000).toFixed(1)}s remaining
              </span>
            )}
          </div>
        </div>

        <div className="mb-4 flex min-h-[36px] flex-wrap items-center gap-2">
          {attempts.map((a) => (
            <div
              key={a.id}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: a.status === 'ok' ? c.successBg : c.failureBg,
                color: a.status === 'ok' ? c.success : c.failure,
                border: `1.5px solid ${a.status === 'ok' ? c.success : c.failure}40`,
                animation: 'pf-pop 200ms ease-out',
              }}
            >
              {a.status === 'ok' ? '✓' : '✕'}
            </div>
          ))}
          {attempts.length === 0 && (
            <span style={{ color: c.textMuted }} className="font-mono text-xs">
              click Send to start
            </span>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSend}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            style={{
              background:
                flash === 'blocked' ? c.failure : flash === 'ok' ? c.success : c.controlActive,
              color: dark ? 'oklch(15% 0.005 75)' : 'oklch(99% 0.005 75)',
              border: `1px solid ${flash === 'blocked' ? c.failure : flash === 'ok' ? c.success : c.controlActive}`,
              outlineColor: c.controlActive,
              transition: 'background 150ms, border-color 150ms',
            }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pf-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
