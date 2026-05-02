'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

export type PipelineFlowNode = {
  id: string;
  label: string;
};

export type PipelineFlowProps = {
  nodes: PipelineFlowNode[];
  sourceLabel?: string;
};

type NodeVisual = 'idle' | 'active' | 'success';

type Point = { x: number; y: number };

const VW = 640;
const VH = 100;
const TRAVEL_MS = 450;
const NODE_PAUSE_MS = 250;
const SETTLE_MS = 500;

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
    pulse: 'oklch(74% 0.17 75)',
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
    pulse: 'oklch(80% 0.17 75)',
    controlBg: 'oklch(20% 0.006 75)',
    controlBorder: 'oklch(32% 0.008 75)',
    controlActive: 'oklch(78% 0.16 75)',
    controlText: 'oklch(75% 0.008 75)',
  },
} as const;

function getPositions(nodeCount: number) {
  const padding = 46;
  const totalPoints = nodeCount + 2;
  const available = VW - padding * 2;
  const step = available / (totalPoints - 1);
  const y = VH / 2;

  return {
    source: { x: padding, y },
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      x: padding + (i + 1) * step,
      y,
    })),
    result: { x: VW - padding, y },
  };
}

export function PipelineFlow({ nodes, sourceLabel = 'send' }: PipelineFlowProps) {
  const dark = useTheme();
  const reducedMotion = useReducedMotion();
  const c = dark ? palette.dark : palette.light;

  const [nodeStates, setNodeStates] = useState<NodeVisual[]>(() => nodes.map(() => 'idle'));
  const [resultState, setResultState] = useState<NodeVisual>('idle');
  const [activeWires, setActiveWires] = useState<Set<number>>(new Set());
  const [successWires, setSuccessWires] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);

  const abortRef = useRef({ aborted: false });
  const pulseRef = useRef<SVGCircleElement | null>(null);
  const pathRefs = useRef<Map<number, SVGPathElement>>(new Map());

  const pos = getPositions(nodes.length);

  const allPoints = [pos.source, ...pos.nodes, pos.result];
  const wireCount = allPoints.length - 1;

  const resetVisuals = useCallback(() => {
    setNodeStates(nodes.map(() => 'idle'));
    setResultState('idle');
    setActiveWires(new Set());
    setSuccessWires(new Set());
    if (pulseRef.current) pulseRef.current.setAttribute('opacity', '0');
  }, [nodes.length]);

  const animatePulse = useCallback(
    (pathIdx: number, duration: number): Promise<boolean> => {
      const pulseEl = pulseRef.current;
      const pathEl = pathRefs.current.get(pathIdx);
      if (!pulseEl || !pathEl) return Promise.resolve(false);

      const pulse = pulseEl;
      const path = pathEl;
      const total = path.getTotalLength();

      if (reducedMotion) {
        const end = path.getPointAtLength(total);
        pulse.setAttribute('cx', String(end.x));
        pulse.setAttribute('cy', String(end.y));
        pulse.setAttribute('opacity', '1');
        return Promise.resolve(true);
      }

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

  const handleSend = useCallback(async () => {
    if (running) return;
    abortRef.current = { aborted: false };
    setRunning(true);
    resetVisuals();

    await wait(80);
    const abort = abortRef.current;

    for (let i = 0; i < wireCount; i++) {
      if (abort.aborted) break;

      setActiveWires((prev) => new Set([...prev, i]));
      const ok = await animatePulse(i, TRAVEL_MS);
      if (!ok) break;

      setSuccessWires((prev) => new Set([...prev, i]));
      setActiveWires((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });

      const targetIdx = i + 1;
      const isResult = targetIdx === allPoints.length - 1;
      const isNode = targetIdx > 0 && targetIdx < allPoints.length - 1;

      if (isNode) {
        const nodeIdx = targetIdx - 1;
        setNodeStates((prev) => prev.map((s, j) => (j === nodeIdx ? 'active' : s)));
        await wait(NODE_PAUSE_MS, abort);
        if (abort.aborted) break;
        setNodeStates((prev) => prev.map((s, j) => (j === nodeIdx ? 'success' : s)));
      }

      if (isResult) {
        setResultState('success');
      }
    }

    if (pulseRef.current) pulseRef.current.setAttribute('opacity', '0');
    await wait(SETTLE_MS);
    setRunning(false);
  }, [running, wireCount, allPoints.length, resetVisuals, animatePulse]);

  const wireColor = (idx: number) => {
    if (successWires.has(idx)) return c.success;
    if (activeWires.has(idx)) return c.wireActive;
    return c.wire;
  };

  const wireWidth = (idx: number) => {
    if (successWires.has(idx) || activeWires.has(idx)) return 2.5;
    return 1.5;
  };

  const wireOpacity = (idx: number) => {
    if (successWires.has(idx) || activeWires.has(idx)) return 1;
    return 0.5;
  };

  const nodeColor = (state: NodeVisual) => {
    if (state === 'success') return c.success;
    if (state === 'active') return c.wireActive;
    return c.nodeBorder;
  };

  const nodeFill = (state: NodeVisual) => {
    if (state === 'success') return dark ? 'oklch(25% 0.06 155)' : 'oklch(95% 0.04 155)';
    if (state === 'active') return dark ? 'oklch(25% 0.05 75)' : 'oklch(95% 0.04 75)';
    return c.node;
  };

  const RX = 10;
  const NODE_H = 30;
  const NODE_W_MIN = 80;
  const CHAR_W = 6.2;

  return (
    <div className="not-prose">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full select-none"
        style={{ maxHeight: '140px' }}
        role="img"
        aria-label={`Pipeline flow diagram with ${nodes.length} steps`}
      >
        <defs>
          <filter id="pf-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pf-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: wireCount }, (_, i) => {
          const from = allPoints[i];
          const to = allPoints[i + 1];
          return (
            <path
              key={i}
              ref={(el) => {
                if (el) pathRefs.current.set(i, el);
              }}
              d={wirePath(from, to)}
              fill="none"
              stroke={wireColor(i)}
              strokeWidth={wireWidth(i)}
              opacity={wireOpacity(i)}
              style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
            />
          );
        })}

        <g>
          <circle
            cx={pos.source.x}
            cy={pos.source.y}
            r={18}
            fill={c.node}
            stroke={c.nodeBorder}
            strokeWidth={1.5}
          />
          <text
            x={pos.source.x}
            y={pos.source.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={c.text}
            fontSize={10}
            fontWeight={500}
            fontFamily="system-ui, sans-serif"
          >
            {sourceLabel}
          </text>
        </g>

        {nodes.map((node, idx) => {
          const p = pos.nodes[idx];
          const state = nodeStates[idx];
          const isActive = state === 'active' || state === 'success';
          const w = Math.max(NODE_W_MIN, node.label.length * CHAR_W + 20);

          return (
            <g key={node.id}>
              <rect
                x={p.x - w / 2}
                y={p.y - NODE_H / 2}
                width={w}
                height={NODE_H}
                rx={RX}
                ry={RX}
                fill={nodeFill(state)}
                stroke={nodeColor(state)}
                strokeWidth={isActive ? 2 : 1.5}
                filter={isActive ? 'url(#pf-glow-sm)' : undefined}
                style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
              />
              <text
                x={p.x}
                y={p.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isActive ? nodeColor(state) : c.text}
                fontSize={10}
                fontWeight={500}
                fontFamily="system-ui, sans-serif"
                style={{ transition: 'fill 200ms' }}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        <g>
          <circle
            cx={pos.result.x}
            cy={pos.result.y}
            r={16}
            fill={
              resultState === 'success'
                ? dark
                  ? 'oklch(25% 0.06 155)'
                  : 'oklch(95% 0.04 155)'
                : c.node
            }
            stroke={resultState === 'success' ? c.success : c.nodeBorder}
            strokeWidth={resultState === 'success' ? 2 : 1.5}
            filter={resultState === 'success' ? 'url(#pf-glow-sm)' : undefined}
            style={{ transition: 'fill 200ms, stroke 200ms' }}
          />
          <text
            x={pos.result.x}
            y={pos.result.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill={resultState === 'success' ? c.success : c.textMuted}
            fontSize={resultState === 'success' ? 14 : 10}
            fontWeight={resultState === 'success' ? 700 : 400}
            fontFamily="system-ui, sans-serif"
            style={{ transition: 'fill 200ms' }}
          >
            {resultState === 'success' ? '✓' : '?'}
          </text>
        </g>

        <circle ref={pulseRef} r={5} fill={c.pulse} opacity={0} filter="url(#pf-glow)" />
      </svg>

      <div className="flex justify-end mt-2">
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
