'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

export type IdempotencyDemoProps = {
  ttlMs?: number;
};

type Entry = {
  id: number;
  key: string;
  status: 'sent' | 'cached';
  timestamp: number;
};

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
    cached: 'oklch(65% 0.16 250)',
    cachedBg: 'oklch(95% 0.04 250)',
    controlBg: 'oklch(94% 0.005 75)',
    controlBorder: 'oklch(85% 0.008 75)',
    controlActive: 'oklch(74% 0.16 75)',
    controlText: 'oklch(40% 0.01 75)',
    barBg: 'oklch(92% 0.005 75)',
    barFill: 'oklch(65% 0.16 250)',
    bg: 'oklch(98% 0.003 75)',
  },
  dark: {
    node: 'oklch(20% 0.006 75)',
    nodeBorder: 'oklch(36% 0.01 75)',
    text: 'oklch(82% 0.008 75)',
    textMuted: 'oklch(55% 0.01 75)',
    success: 'oklch(70% 0.18 155)',
    successBg: 'oklch(25% 0.06 155)',
    cached: 'oklch(72% 0.14 250)',
    cachedBg: 'oklch(22% 0.05 250)',
    controlBg: 'oklch(20% 0.006 75)',
    controlBorder: 'oklch(32% 0.008 75)',
    controlActive: 'oklch(78% 0.16 75)',
    controlText: 'oklch(75% 0.008 75)',
    barBg: 'oklch(25% 0.006 75)',
    barFill: 'oklch(72% 0.14 250)',
    bg: 'oklch(16% 0.004 75)',
  },
} as const;

const KEYS = ['order:1001', 'order:1002', 'order:1003'];

export function IdempotencyDemo({ ttlMs = 8000 }: IdempotencyDemoProps) {
  const dark = useTheme();
  const c = dark ? palette.dark : palette.light;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [cache, setCache] = useState<Map<string, { expiresAt: number }>>(new Map());
  const [selectedKey, setSelectedKey] = useState(KEYS[0]);
  const [flash, setFlash] = useState<'sent' | 'cached' | null>(null);
  const [, setTick] = useState(0);
  const nextId = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, []);

  const now = Date.now();

  const handleSend = useCallback(() => {
    const ts = Date.now();
    const existing = cache.get(selectedKey);
    const isCached = existing !== undefined && existing.expiresAt > ts;

    const entry: Entry = {
      id: nextId.current++,
      key: selectedKey,
      status: isCached ? 'cached' : 'sent',
      timestamp: ts,
    };

    setEntries((prev) => [...prev, entry]);

    if (!isCached) {
      setCache((prev) => {
        const next = new Map(prev);
        next.set(selectedKey, { expiresAt: ts + ttlMs });
        return next;
      });
    }

    setFlash(entry.status);
    setTimeout(() => setFlash(null), 400);
  }, [selectedKey, cache, ttlMs]);

  const activeKeys = Array.from(cache.entries()).filter(([, v]) => v.expiresAt > now);

  return (
    <div className="not-prose">
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: c.nodeBorder, background: c.bg }}
      >
        <div className="mb-4">
          <span
            style={{ color: c.textMuted }}
            className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
          >
            idempotency key
          </span>
          <div className="flex flex-wrap gap-1.5">
            {KEYS.map((k) => {
              const active = cache.get(k);
              const isActive = active !== undefined && active.expiresAt > now;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors duration-100',
                    'focus-visible:outline-2 focus-visible:outline-offset-2',
                  )}
                  style={{
                    background: selectedKey === k ? c.controlActive : c.controlBg,
                    color:
                      selectedKey === k
                        ? dark
                          ? 'oklch(15% 0.005 75)'
                          : 'oklch(99% 0.005 75)'
                        : c.controlText,
                    border: `1px solid ${selectedKey === k ? c.controlActive : c.controlBorder}`,
                    outlineColor: c.controlActive,
                  }}
                >
                  {k}
                  {isActive && (
                    <span
                      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: c.cached }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeKeys.length > 0 && (
          <div className="mb-4">
            <span
              style={{ color: c.textMuted }}
              className="mb-2 block font-mono text-[10px] uppercase tracking-widest"
            >
              cached keys
            </span>
            <div className="flex flex-col gap-1.5">
              {activeKeys.map(([key, val]) => {
                const remaining = Math.max(0, val.expiresAt - now);
                const pct = 1 - remaining / ttlMs;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span style={{ color: c.text }} className="w-24 shrink-0 font-mono text-xs">
                      {key}
                    </span>
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: c.barBg }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct * 100}%`,
                          background: c.barFill,
                          transition: 'width 100ms linear',
                        }}
                      />
                    </div>
                    <span
                      style={{ color: c.textMuted }}
                      className="w-10 shrink-0 text-right font-mono text-[10px]"
                    >
                      {(remaining / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4 flex min-h-[36px] flex-wrap items-center gap-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px]"
              style={{
                background: e.status === 'sent' ? c.successBg : c.cachedBg,
                color: e.status === 'sent' ? c.success : c.cached,
                border: `1px solid ${e.status === 'sent' ? c.success : c.cached}30`,
                animation: 'idem-pop 200ms ease-out',
              }}
            >
              <span className="font-semibold">{e.status === 'sent' ? '✓ sent' : '↩ cached'}</span>
              <span style={{ opacity: 0.6 }}>{e.key}</span>
            </div>
          ))}
          {entries.length === 0 && (
            <span style={{ color: c.textMuted }} className="font-mono text-xs">
              pick a key and click Send
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
                flash === 'cached' ? c.cached : flash === 'sent' ? c.success : c.controlActive,
              color: dark ? 'oklch(15% 0.005 75)' : 'oklch(99% 0.005 75)',
              border: `1px solid ${flash === 'cached' ? c.cached : flash === 'sent' ? c.success : c.controlActive}`,
              outlineColor: c.controlActive,
              transition: 'background 150ms, border-color 150ms',
            }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes idem-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
