'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

type SignalFlowNode = {
  id: string;
  label: string;
};

type SignalFlowStrategy = 'failover' | 'round-robin' | 'random' | 'race' | 'parallel' | 'mirrored';

type SignalFlowProps = {
  nodes: SignalFlowNode[];
  strategies?: SignalFlowStrategy[];
  defaultStrategy?: SignalFlowStrategy;
  maxRetries?: number;
};

type NodeVisual = 'idle' | 'active' | 'success' | 'failure';

type Point = { x: number; y: number };

const VW = 640;
const VH = 260;
const TRAVEL_MS = 650;
const ATTEMPT_MS = 350;
const RETRY_MS = 250;
const SETTLE_MS = 500;

const ALL_STRATEGIES: SignalFlowStrategy[] = [
  'failover',
  'round-robin',
  'random',
  'race',
  'parallel',
  'mirrored',
];

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

function wait(ms: number, signal?: { aborted: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(true), ms);
    if (signal) {
      const check = setInterval(() => {
        if (signal.aborted) {
          clearTimeout(id);
          clearInterval(check);
          resolve(false);
        }
      }, 16);
      setTimeout(() => clearInterval(check), ms + 50);
    }
  });
}

function getPositions(count: number) {
  const source: Point = { x: 56, y: VH / 2 };
  const result: Point = { x: VW - 56, y: VH / 2 };
  const padding = 44;
  const spread = VH - padding * 2;
  const step = count > 1 ? spread / (count - 1) : 0;

  const transports: Point[] = Array.from({ length: count }, (_, i) => ({
    x: VW * 0.46,
    y: count > 1 ? padding + i * step : VH / 2,
  }));

  return { source, transports, result };
}

function wirePath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  return `M ${from.x} ${from.y} C ${from.x + dx * 0.45} ${from.y}, ${to.x - dx * 0.45} ${to.y}, ${to.x} ${to.y}`;
}

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

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

const palette = {
  light: {
    wire: 'oklch(82% 0.008 75)',
    wireActive: 'oklch(74% 0.16 75)',
    node: 'oklch(96% 0.004 75)',
    nodeBorder: 'oklch(78% 0.012 75)',
    text: 'oklch(35% 0.01 75)',
    textMuted: 'oklch(55% 0.01 75)',
    success: 'oklch(62% 0.19 155)',
    failure: 'oklch(58% 0.2 27)',
    pulse: 'oklch(74% 0.17 75)',
    pulseGlow: 'oklch(80% 0.14 75 / 0.5)',
    bg: 'oklch(98% 0.003 75)',
    controlBg: 'oklch(94% 0.005 75)',
    controlBorder: 'oklch(85% 0.008 75)',
    controlActive: 'oklch(74% 0.16 75)',
    controlText: 'oklch(40% 0.01 75)',
  },
  dark: {
    wire: 'oklch(30% 0.008 75)',
    wireActive: 'oklch(78% 0.16 75)',
    node: 'oklch(20% 0.006 75)',
    nodeBorder: 'oklch(36% 0.01 75)',
    text: 'oklch(82% 0.008 75)',
    textMuted: 'oklch(55% 0.01 75)',
    success: 'oklch(70% 0.18 155)',
    failure: 'oklch(65% 0.2 27)',
    pulse: 'oklch(80% 0.17 75)',
    pulseGlow: 'oklch(85% 0.14 75 / 0.5)',
    bg: 'oklch(14% 0.005 75)',
    controlBg: 'oklch(20% 0.006 75)',
    controlBorder: 'oklch(32% 0.008 75)',
    controlActive: 'oklch(78% 0.16 75)',
    controlText: 'oklch(75% 0.008 75)',
  },
} as const;

function SignalFlow({
  nodes,
  strategies = ALL_STRATEGIES,
  defaultStrategy = 'failover',
  maxRetries = 1,
}: SignalFlowProps) {
  const dark = useTheme();
  const reducedMotion = useReducedMotion();
  const c = dark ? palette.dark : palette.light;

  const [strategy, setStrategy] = useState<SignalFlowStrategy>(defaultStrategy);
  const [health, setHealth] = useState<boolean[]>(() => nodes.map(() => true));
  const [nodeStates, setNodeStates] = useState<NodeVisual[]>(() => nodes.map(() => 'idle'));
  const [resultState, setResultState] = useState<NodeVisual>('idle');
  const [activeWires, setActiveWires] = useState<Set<string>>(new Set());
  const [successWires, setSuccessWires] = useState<Set<string>>(new Set());
  const [failWires, setFailWires] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState<number[]>(() => nodes.map(() => 0));
  const [rrCounter, setRrCounter] = useState(0);

  const abortRef = useRef({ aborted: false });
  const pulseRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const pos = getPositions(nodes.length);

  const resetVisuals = useCallback(() => {
    setNodeStates(nodes.map(() => 'idle'));
    setResultState('idle');
    setActiveWires(new Set());
    setSuccessWires(new Set());
    setFailWires(new Set());
    setAttempts(nodes.map(() => 0));
    pulseRefs.current.forEach((el) => {
      el.setAttribute('opacity', '0');
    });
  }, [nodes.length]);

  const animatePulse = useCallback(
    (pulseId: string, pathId: string, duration: number): Promise<boolean> => {
      const pulseEl = pulseRefs.current.get(pulseId);
      const pathEl = pathRefs.current.get(pathId);
      if (!pulseEl || !pathEl) return Promise.resolve(false);
      const pulse = pulseEl;
      const path = pathEl;

      if (reducedMotion) {
        const total = path.getTotalLength();
        const end = path.getPointAtLength(total);
        pulse.setAttribute('cx', String(end.x));
        pulse.setAttribute('cy', String(end.y));
        pulse.setAttribute('opacity', '1');
        return Promise.resolve(true);
      }

      const total = path.getTotalLength();
      const start = performance.now();
      const abort = abortRef.current;

      return new Promise((resolve) => {
        pulse.setAttribute('opacity', '1');

        function frame(now: number) {
          if (abort.aborted) {
            pulse.setAttribute('opacity', '0');
            resolve(false);
            return;
          }
          const t = Math.min((now - start) / duration, 1);
          const eased = easeOutQuart(t);
          const pt = path.getPointAtLength(eased * total);
          pulse.setAttribute('cx', String(pt.x));
          pulse.setAttribute('cy', String(pt.y));

          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            resolve(true);
          }
        }
        requestAnimationFrame(frame);
      });
    },
    [reducedMotion],
  );

  const hidePulse = useCallback((pulseId: string) => {
    const el = pulseRefs.current.get(pulseId);
    if (el) el.setAttribute('opacity', '0');
  }, []);

  const runSequential = useCallback(
    async (order: number[]) => {
      const abort = abortRef.current;

      for (const idx of order) {
        if (abort.aborted) return;

        const inWireId = `in-${idx}`;
        setActiveWires((prev) => new Set([...prev, inWireId]));

        const ok = await animatePulse('main', inWireId, TRAVEL_MS);
        if (!ok) return;

        let succeeded = false;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (abort.aborted) return;

          setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
          setAttempts((prev) => prev.map((a, i) => (i === idx ? attempt + 1 : a)));

          const ok2 = await wait(ATTEMPT_MS, abort);
          if (!ok2) return;

          if (health[idx]) {
            succeeded = true;
            setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'success' : s)));

            const outWireId = `out-${idx}`;
            setSuccessWires((prev) => new Set([...prev, inWireId, outWireId]));
            setActiveWires((prev) => {
              const next = new Set(prev);
              next.delete(inWireId);
              return next;
            });

            await wait(200, abort);
            await animatePulse('main', outWireId, TRAVEL_MS * 0.7);

            setResultState('success');
            hidePulse('main');
            return;
          }

          setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'failure' : s)));
          setFailWires((prev) => new Set([...prev, inWireId]));
          setActiveWires((prev) => {
            const next = new Set(prev);
            next.delete(inWireId);
            return next;
          });

          if (attempt < maxRetries - 1) {
            await wait(RETRY_MS, abort);
            setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
          }
        }

        hidePulse('main');

        if (!succeeded) {
          await wait(200, abort);
        }
      }

      setResultState('failure');
    },
    [health, maxRetries, animatePulse, hidePulse],
  );

  const runParallel = useCallback(
    async (mode: 'race' | 'parallel' | 'mirrored') => {
      const abort = abortRef.current;
      const count = nodes.length;

      const travelPromises = Array.from({ length: count }, (_, idx) => {
        const wireId = `in-${idx}`;
        setActiveWires((prev) => new Set([...prev, wireId]));
        return animatePulse(`p-${idx}`, wireId, TRAVEL_MS);
      });

      await Promise.all(travelPromises);
      if (abort.aborted) return;

      for (let idx = 0; idx < count; idx++) {
        setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
        setAttempts((prev) => prev.map((a, i) => (i === idx ? 1 : a)));
      }

      await wait(ATTEMPT_MS, abort);
      if (abort.aborted) return;

      if (mode === 'race') {
        const firstHealthy = Array.from({ length: count }).findIndex((_, i) => health[i]);

        for (let idx = 0; idx < count; idx++) {
          const isWinner = idx === firstHealthy;
          setNodeStates((prev) =>
            prev.map((s, i) => {
              if (i !== idx) return s;
              return health[i] && isWinner ? 'success' : health[i] ? 'idle' : 'failure';
            }),
          );
          const inWire = `in-${idx}`;
          if (health[idx] && isWinner) {
            setSuccessWires((prev) => new Set([...prev, inWire]));
          } else if (!health[idx]) {
            setFailWires((prev) => new Set([...prev, inWire]));
          }
          setActiveWires((prev) => {
            const next = new Set(prev);
            next.delete(inWire);
            return next;
          });
          if (idx !== firstHealthy) hidePulse(`p-${idx}`);
        }

        if (firstHealthy >= 0) {
          const outWire = `out-${firstHealthy}`;
          setSuccessWires((prev) => new Set([...prev, outWire]));
          await wait(200, abort);
          await animatePulse(`p-${firstHealthy}`, outWire, TRAVEL_MS * 0.7);
          setResultState('success');
          hidePulse(`p-${firstHealthy}`);
        } else {
          setResultState('failure');
          for (let i = 0; i < count; i++) hidePulse(`p-${i}`);
        }
      } else if (mode === 'parallel') {
        const allHealthy = health.every(Boolean);

        for (let idx = 0; idx < count; idx++) {
          setNodeStates((prev) =>
            prev.map((s, i) => (i === idx ? (health[i] ? 'success' : 'failure') : s)),
          );
          const inWire = `in-${idx}`;
          if (health[idx]) {
            setSuccessWires((prev) => new Set([...prev, inWire]));
          } else {
            setFailWires((prev) => new Set([...prev, inWire]));
          }
          setActiveWires((prev) => {
            const next = new Set(prev);
            next.delete(inWire);
            return next;
          });
        }

        if (allHealthy) {
          await wait(200, abort);
          const outPromises = Array.from({ length: count }, (_, idx) => {
            const outWire = `out-${idx}`;
            setSuccessWires((prev) => new Set([...prev, outWire]));
            return animatePulse(`p-${idx}`, outWire, TRAVEL_MS * 0.7);
          });
          await Promise.all(outPromises);
          setResultState('success');
        } else {
          setResultState('failure');
        }
        for (let i = 0; i < count; i++) hidePulse(`p-${i}`);
      } else {
        const primaryHealthy = health[0];
        setNodeStates((prev) =>
          prev.map((s, i) => {
            if (i === 0) return primaryHealthy ? 'success' : 'failure';
            return health[i] ? 'success' : 'idle';
          }),
        );

        for (let idx = 0; idx < count; idx++) {
          const inWire = `in-${idx}`;
          if (idx === 0) {
            if (primaryHealthy) setSuccessWires((prev) => new Set([...prev, inWire]));
            else setFailWires((prev) => new Set([...prev, inWire]));
          } else if (health[idx]) {
            setSuccessWires((prev) => new Set([...prev, inWire]));
          }
          setActiveWires((prev) => {
            const next = new Set(prev);
            next.delete(inWire);
            return next;
          });
        }

        if (primaryHealthy) {
          const outWire = `out-0`;
          setSuccessWires((prev) => new Set([...prev, outWire]));
          await wait(200, abort);
          await animatePulse('p-0', outWire, TRAVEL_MS * 0.7);
          setResultState('success');
        } else {
          setResultState('failure');
        }
        for (let i = 0; i < count; i++) hidePulse(`p-${i}`);
      }
    },
    [nodes.length, health, animatePulse, hidePulse],
  );

  const handleSend = useCallback(async () => {
    if (running) return;
    abortRef.current = { aborted: false };
    setRunning(true);
    resetVisuals();

    await wait(100);

    const n = nodes.length;
    let order: number[];

    switch (strategy) {
      case 'failover':
        order = Array.from({ length: n }, (_, i) => i);
        await runSequential(order);
        break;
      case 'round-robin': {
        const start = rrCounter % n;
        order = Array.from({ length: n }, (_, i) => (start + i) % n);
        setRrCounter((c) => c + 1);
        await runSequential(order);
        break;
      }
      case 'random': {
        order = Array.from({ length: n }, (_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        await runSequential(order);
        break;
      }
      case 'race':
        await runParallel('race');
        break;
      case 'parallel':
        await runParallel('parallel');
        break;
      case 'mirrored':
        await runParallel('mirrored');
        break;
    }

    await wait(SETTLE_MS);
    setRunning(false);
  }, [running, strategy, nodes.length, rrCounter, resetVisuals, runSequential, runParallel]);

  const handleStrategyChange = useCallback(
    (s: SignalFlowStrategy) => {
      if (running) {
        abortRef.current.aborted = true;
      }
      setStrategy(s);
      setTimeout(() => resetVisuals(), 50);
      setRunning(false);
    },
    [running, resetVisuals],
  );

  const toggleHealth = useCallback(
    (idx: number) => {
      if (running) return;
      resetVisuals();
      setHealth((prev) => prev.map((h, i) => (i === idx ? !h : h)));
    },
    [running, resetVisuals],
  );

  const nodeColor = (state: NodeVisual, healthy: boolean) => {
    if (state === 'success') return c.success;
    if (state === 'failure') return c.failure;
    if (state === 'active') return c.wireActive;
    if (!healthy) return c.failure;
    return c.nodeBorder;
  };

  const nodeFill = (state: NodeVisual, healthy: boolean) => {
    if (state === 'success') return dark ? 'oklch(25% 0.06 155)' : 'oklch(95% 0.04 155)';
    if (state === 'failure') return dark ? 'oklch(22% 0.06 27)' : 'oklch(95% 0.04 27)';
    if (state === 'active') return dark ? 'oklch(25% 0.05 75)' : 'oklch(95% 0.04 75)';
    if (!healthy) return dark ? 'oklch(20% 0.01 27)' : 'oklch(95% 0.01 27)';
    return c.node;
  };

  const wireColor = (wireId: string) => {
    if (successWires.has(wireId)) return c.success;
    if (failWires.has(wireId)) return c.failure;
    if (activeWires.has(wireId)) return c.wireActive;
    return c.wire;
  };

  const wireWidth = (wireId: string) => {
    if (successWires.has(wireId) || failWires.has(wireId) || activeWires.has(wireId)) return 2.5;
    return 1.5;
  };

  const wireOpacity = (wireId: string) => {
    if (successWires.has(wireId) || failWires.has(wireId) || activeWires.has(wireId)) return 1;
    return 0.5;
  };

  return (
    <div className="not-prose" style={{ '--sf-bg': c.bg } as React.CSSProperties}>
      <div className="flex flex-wrap gap-1.5 mb-4 justify-center">
        {strategies.map((s) => (
          <button
            key={s}
            onClick={() => handleStrategyChange(s)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-100',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            style={{
              background: strategy === s ? c.controlActive : c.controlBg,
              color:
                strategy === s
                  ? dark
                    ? 'oklch(15% 0.005 75)'
                    : 'oklch(99% 0.005 75)'
                  : c.controlText,
              border: `1px solid ${strategy === s ? c.controlActive : c.controlBorder}`,
              outlineColor: c.controlActive,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full select-none"
        style={{ maxHeight: '320px' }}
        role="img"
        aria-label={`Signal flow diagram showing ${strategy} strategy with ${nodes.length} transports`}
      >
        <defs>
          <filter id="sf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sf-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {nodes.map((_, idx) => {
          const inId = `in-${idx}`;
          const outId = `out-${idx}`;
          const inPath = wirePath(pos.source, pos.transports[idx]);
          const outPath = wirePath(pos.transports[idx], pos.result);
          return (
            <g key={idx}>
              <path
                ref={(el) => {
                  if (el) pathRefs.current.set(inId, el);
                }}
                d={inPath}
                fill="none"
                stroke={wireColor(inId)}
                strokeWidth={wireWidth(inId)}
                opacity={wireOpacity(inId)}
                style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
              />
              <path
                ref={(el) => {
                  if (el) pathRefs.current.set(outId, el);
                }}
                d={outPath}
                fill="none"
                stroke={wireColor(outId)}
                strokeWidth={wireWidth(outId)}
                opacity={wireOpacity(outId)}
                style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
              />
            </g>
          );
        })}

        <g>
          <circle
            cx={pos.source.x}
            cy={pos.source.y}
            r={20}
            fill={c.node}
            stroke={c.nodeBorder}
            strokeWidth={1.5}
            style={{ transition: 'fill 200ms, stroke 200ms' }}
          />
          <text
            x={pos.source.x}
            y={pos.source.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={c.text}
            fontSize={11}
            fontWeight={500}
            fontFamily="system-ui, sans-serif"
          >
            send
          </text>
        </g>

        {nodes.map((node, idx) => {
          const p = pos.transports[idx];
          const state = nodeStates[idx];
          const h = health[idx];
          const isActive = state === 'active' || state === 'success' || state === 'failure';
          return (
            <g
              key={node.id}
              onClick={() => toggleHealth(idx)}
              style={{ cursor: running ? 'default' : 'pointer' }}
              role="button"
              aria-label={`${node.label}: ${h ? 'healthy' : 'unhealthy'}. Click to toggle.`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleHealth(idx);
                }
              }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={22}
                fill={nodeFill(state, h)}
                stroke={nodeColor(state, h)}
                strokeWidth={isActive ? 2 : 1.5}
                filter={isActive ? 'url(#sf-glow-sm)' : undefined}
                style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
                fillOpacity={state === 'idle' && !h ? 0.3 : 1}
                strokeOpacity={state === 'idle' && !h ? 0.5 : 1}
              />
              <text
                x={p.x}
                y={p.y - 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isActive ? nodeColor(state, h) : h ? c.text : c.failure}
                fontSize={11}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                style={{ transition: 'fill 200ms' }}
              >
                {node.label}
              </text>
              {!h && state === 'idle' && (
                <text
                  x={p.x}
                  y={p.y + 12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={c.failure}
                  fontSize={8}
                  fontFamily="system-ui, sans-serif"
                  opacity={0.8}
                >
                  down
                </text>
              )}
              {attempts[idx] > 0 && state !== 'idle' && (
                <text
                  x={p.x}
                  y={p.y + 13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? nodeColor(state, h) : c.textMuted}
                  fontSize={8}
                  fontFamily="system-ui, sans-serif"
                >
                  {state === 'success' ? '✓' : state === 'failure' ? '✕' : `#${attempts[idx]}`}
                </text>
              )}
            </g>
          );
        })}

        <g>
          <circle
            cx={pos.result.x}
            cy={pos.result.y}
            r={18}
            fill={
              resultState === 'success'
                ? dark
                  ? 'oklch(25% 0.06 155)'
                  : 'oklch(95% 0.04 155)'
                : resultState === 'failure'
                  ? dark
                    ? 'oklch(22% 0.06 27)'
                    : 'oklch(95% 0.04 27)'
                  : c.node
            }
            stroke={
              resultState === 'success'
                ? c.success
                : resultState === 'failure'
                  ? c.failure
                  : c.nodeBorder
            }
            strokeWidth={resultState !== 'idle' ? 2 : 1.5}
            filter={resultState !== 'idle' ? 'url(#sf-glow-sm)' : undefined}
            style={{ transition: 'fill 200ms, stroke 200ms, fill-opacity 200ms' }}
          />
          <text
            x={pos.result.x}
            y={pos.result.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={
              resultState === 'success'
                ? c.success
                : resultState === 'failure'
                  ? c.failure
                  : c.textMuted
            }
            fontSize={resultState !== 'idle' ? 14 : 10}
            fontWeight={resultState !== 'idle' ? 700 : 400}
            fontFamily="system-ui, sans-serif"
            style={{ transition: 'fill 200ms' }}
          >
            {resultState === 'success' ? '✓' : resultState === 'failure' ? '✕' : '?'}
          </text>
        </g>

        <circle
          ref={(el) => {
            if (el) pulseRefs.current.set('main', el);
          }}
          r={5}
          fill={c.pulse}
          opacity={0}
          filter="url(#sf-glow)"
        />
        {nodes.map((_, idx) => (
          <circle
            key={`pulse-${idx}`}
            ref={(el) => {
              if (el) pulseRefs.current.set(`p-${idx}`, el);
            }}
            r={4}
            fill={c.pulse}
            opacity={0}
            filter="url(#sf-glow)"
          />
        ))}
      </svg>

      <div className="flex items-center justify-between mt-3 gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {nodes.map((node, idx) => (
            <button
              key={node.id}
              onClick={() => toggleHealth(idx)}
              disabled={running}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md transition-colors duration-100',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              style={{
                background: c.controlBg,
                border: `1px solid ${c.controlBorder}`,
                color: c.controlText,
                outlineColor: c.controlActive,
              }}
              aria-label={`Toggle ${node.label} health: currently ${health[idx] ? 'up' : 'down'}`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{
                  background: health[idx] ? c.success : c.failure,
                  transition: 'background 150ms',
                }}
              />
              {node.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSend}
          disabled={running}
          className={cn(
            'px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          style={{
            background: c.controlActive,
            color: dark ? 'oklch(15% 0.005 75)' : 'oklch(99% 0.005 75)',
            border: `1px solid ${c.controlActive}`,
            outlineColor: c.controlActive,
          }}
        >
          {running ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export { SignalFlow };
export type { SignalFlowProps, SignalFlowNode, SignalFlowStrategy };
