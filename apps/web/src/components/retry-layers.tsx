'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

const VW = 640;
const LANE_H = 56;
const LANE_GAP = 16;
const PAD_Y = 12;
const VH = 3 * LANE_H + 2 * LANE_GAP + PAD_Y * 2;
const TRAVEL_MS = 350;
const NODE_PAUSE_MS = 300;
const FAIL_PAUSE_MS = 450;
const SETTLE_MS = 600;
const STAGGER_MS = 250;

type Point = { x: number; y: number };
type NodeVisual = 'idle' | 'active' | 'success' | 'fail';

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

function curvePath(from: Point, to: Point): string {
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
    controlActive: 'oklch(74% 0.16 75)',
    laneBg: 'oklch(97% 0.003 75)',
    laneBorder: 'oklch(88% 0.008 75)',
    successFill: 'oklch(95% 0.04 155)',
    failFill: 'oklch(95% 0.04 27)',
    activeFill: 'oklch(95% 0.04 75)',
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
    controlActive: 'oklch(78% 0.16 75)',
    laneBg: 'oklch(16% 0.004 75)',
    laneBorder: 'oklch(28% 0.006 75)',
    successFill: 'oklch(25% 0.06 155)',
    failFill: 'oklch(22% 0.06 27)',
    activeFill: 'oklch(25% 0.05 75)',
  },
} as const;

type LaneConfig = {
  id: string;
  label: string;
  scope: string;
  failNode: string;
  successNode: string;
  failReason: string;
};

const LANES: LaneConfig[] = [
  {
    id: 'http',
    label: 'HTTP retry',
    scope: 'single request',
    failNode: 'request',
    successNode: 'retry',
    failReason: '503',
  },
  {
    id: 'multi',
    label: 'Multi-transport',
    scope: 'across providers',
    failNode: 'Resend',
    successNode: 'SMTP',
    failReason: 'down',
  },
  {
    id: 'queue',
    label: 'Queue retry',
    scope: 'full pipeline',
    failNode: 'pipeline',
    successNode: 're-enqueue',
    failReason: 'crash',
  },
];

function laneY(index: number): number {
  return PAD_Y + index * (LANE_H + LANE_GAP) + LANE_H / 2;
}

function lanePositions(index: number) {
  const y = laneY(index);
  return {
    start: { x: 160, y },
    node1: { x: 280, y },
    node2: { x: 430, y },
    result: { x: 575, y },
  };
}

export function RetryLayers() {
  const dark = useTheme();
  const reducedMotion = useReducedMotion();
  const c = dark ? palette.dark : palette.light;

  const [node1States, setNode1States] = useState<NodeVisual[]>(['idle', 'idle', 'idle']);
  const [node2States, setNode2States] = useState<NodeVisual[]>(['idle', 'idle', 'idle']);
  const [resultStates, setResultStates] = useState<NodeVisual[]>(['idle', 'idle', 'idle']);
  const [activeWires, setActiveWires] = useState<Set<string>>(new Set());
  const [successWires, setSuccessWires] = useState<Set<string>>(new Set());
  const [failWires, setFailWires] = useState<Set<string>>(new Set());
  const [failReasons, setFailReasons] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);

  const abortRef = useRef({ aborted: false });
  const pulseRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  const resetVisuals = useCallback(() => {
    setNode1States(['idle', 'idle', 'idle']);
    setNode2States(['idle', 'idle', 'idle']);
    setResultStates(['idle', 'idle', 'idle']);
    setActiveWires(new Set());
    setSuccessWires(new Set());
    setFailWires(new Set());
    setFailReasons(new Set());
    pulseRefs.current.forEach((el) => el.setAttribute('opacity', '0'));
  }, []);

  const animatePulse = useCallback(
    (pulseId: string, pathId: string, duration: number): Promise<boolean> => {
      const pulseEl = pulseRefs.current.get(pulseId);
      const pathEl = pathRefs.current.get(pathId);
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
          const pt = path.getPointAtLength(easeOutQuart(t) * total);
          pulse.setAttribute('cx', String(pt.x));
          pulse.setAttribute('cy', String(pt.y));
          if (t < 1) requestAnimationFrame(frame);
          else resolve(true);
        }
        requestAnimationFrame(frame);
      });
    },
    [reducedMotion],
  );

  const hidePulse = useCallback((id: string) => {
    const el = pulseRefs.current.get(id);
    if (el) el.setAttribute('opacity', '0');
  }, []);

  const animateLane = useCallback(
    async (idx: number) => {
      const abort = abortRef.current;
      const pid = `p-${idx}`;
      const w0 = `w-${idx}-0`;
      const w1 = `w-${idx}-1`;
      const w2 = `w-${idx}-2`;

      setActiveWires((prev) => new Set([...prev, w0]));
      if (!(await animatePulse(pid, w0, TRAVEL_MS))) return;

      setNode1States((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
      if (!(await wait(NODE_PAUSE_MS, abort))) return;

      setNode1States((prev) => prev.map((s, i) => (i === idx ? 'fail' : s)));
      setFailWires((prev) => new Set([...prev, w0]));
      setActiveWires((prev) => {
        const n = new Set(prev);
        n.delete(w0);
        return n;
      });
      setFailReasons((prev) => new Set([...prev, idx]));
      hidePulse(pid);
      if (!(await wait(FAIL_PAUSE_MS, abort))) return;

      setActiveWires((prev) => new Set([...prev, w1]));
      if (!(await animatePulse(pid, w1, TRAVEL_MS))) return;

      setNode2States((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
      setSuccessWires((prev) => new Set([...prev, w1]));
      setActiveWires((prev) => {
        const n = new Set(prev);
        n.delete(w1);
        return n;
      });
      if (!(await wait(NODE_PAUSE_MS, abort))) return;

      setNode2States((prev) => prev.map((s, i) => (i === idx ? 'success' : s)));

      setSuccessWires((prev) => new Set([...prev, w2]));
      if (!(await wait(120, abort))) return;
      if (!(await animatePulse(pid, w2, TRAVEL_MS * 0.6))) return;

      setResultStates((prev) => prev.map((s, i) => (i === idx ? 'success' : s)));
      hidePulse(pid);
    },
    [animatePulse, hidePulse],
  );

  const handleSend = useCallback(async () => {
    if (running) return;
    setRunning(true);
    abortRef.current = { aborted: false };
    resetVisuals();
    await wait(100);

    for (let i = 0; i < LANES.length; i++) {
      if (abortRef.current.aborted) break;
      await animateLane(i);
      if (i < LANES.length - 1) await wait(STAGGER_MS, abortRef.current);
    }

    await wait(SETTLE_MS);
    setRunning(false);
  }, [running, resetVisuals, animateLane]);

  const wireColor = (id: string) => {
    if (successWires.has(id)) return c.success;
    if (failWires.has(id)) return c.failure;
    if (activeWires.has(id)) return c.wireActive;
    return c.wire;
  };

  const wireWidth = (id: string) =>
    successWires.has(id) || failWires.has(id) || activeWires.has(id) ? 2.5 : 1.5;

  const wireOpacity = (id: string) =>
    successWires.has(id) || failWires.has(id) || activeWires.has(id) ? 1 : 0.5;

  const nodeStroke = (state: NodeVisual) => {
    if (state === 'success') return c.success;
    if (state === 'fail') return c.failure;
    if (state === 'active') return c.wireActive;
    return c.nodeBorder;
  };

  const nodeFill = (state: NodeVisual) => {
    if (state === 'success') return c.successFill;
    if (state === 'fail') return c.failFill;
    if (state === 'active') return c.activeFill;
    return c.node;
  };

  const CHAR_W = 6.2;
  const NODE_MIN_W = 76;
  const NODE_HT = 28;
  const RX = 10;
  const RESULT_R = 14;

  return (
    <div className="not-prose">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full select-none"
        style={{ maxHeight: '280px' }}
        role="img"
        aria-label="Retry layers: HTTP retry, multi-transport, and queue retry scopes"
      >
        <defs>
          <filter id="rl-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="rl-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {LANES.map((lane, idx) => {
          const y = laneY(idx);
          const pos = lanePositions(idx);
          const n1 = node1States[idx];
          const n2 = node2States[idx];
          const res = resultStates[idx];
          const n1Active = n1 !== 'idle';
          const n2Active = n2 !== 'idle';

          const n1W = Math.max(NODE_MIN_W, lane.failNode.length * CHAR_W + 24);
          const n2W = Math.max(NODE_MIN_W, lane.successNode.length * CHAR_W + 24);

          const w0 = `w-${idx}-0`;
          const w1 = `w-${idx}-1`;
          const w2 = `w-${idx}-2`;

          const retryWireVisible = failWires.has(w0) || activeWires.has(w1) || successWires.has(w1);

          return (
            <g key={lane.id}>
              <rect
                x={4}
                y={y - LANE_H / 2}
                width={VW - 8}
                height={LANE_H}
                rx={10}
                fill={c.laneBg}
                stroke={c.laneBorder}
                strokeWidth={1}
                opacity={0.6}
              />

              <text
                x={20}
                y={y - 7}
                fill={c.text}
                fontSize={11}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
              >
                {lane.label}
              </text>
              <text
                x={20}
                y={y + 7}
                fill={c.textMuted}
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                {lane.scope}
              </text>

              <path
                ref={(el) => {
                  if (el) pathRefs.current.set(w0, el);
                }}
                d={curvePath(pos.start, pos.node1)}
                fill="none"
                stroke={wireColor(w0)}
                strokeWidth={wireWidth(w0)}
                opacity={wireOpacity(w0)}
                style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
              />
              <path
                ref={(el) => {
                  if (el) pathRefs.current.set(w1, el);
                }}
                d={curvePath(pos.node1, pos.node2)}
                fill="none"
                stroke={wireColor(w1)}
                strokeWidth={wireWidth(w1)}
                opacity={retryWireVisible ? wireOpacity(w1) : 0.25}
                strokeDasharray={retryWireVisible ? 'none' : '4 3'}
                style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 300ms' }}
              />
              <path
                ref={(el) => {
                  if (el) pathRefs.current.set(w2, el);
                }}
                d={curvePath(pos.node2, pos.result)}
                fill="none"
                stroke={wireColor(w2)}
                strokeWidth={wireWidth(w2)}
                opacity={wireOpacity(w2)}
                style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
              />

              <rect
                x={pos.node1.x - n1W / 2}
                y={pos.node1.y - NODE_HT / 2}
                width={n1W}
                height={NODE_HT}
                rx={RX}
                fill={nodeFill(n1)}
                stroke={nodeStroke(n1)}
                strokeWidth={n1Active ? 2 : 1.5}
                filter={n1Active ? 'url(#rl-glow-sm)' : undefined}
                style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
              />
              <text
                x={pos.node1.x}
                y={pos.node1.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={n1Active ? nodeStroke(n1) : c.text}
                fontSize={10}
                fontWeight={500}
                fontFamily="system-ui, sans-serif"
                style={{ transition: 'fill 200ms' }}
              >
                {lane.failNode}
              </text>

              {failReasons.has(idx) && (
                <text
                  x={pos.node1.x}
                  y={pos.node1.y - NODE_HT / 2 - 6}
                  textAnchor="middle"
                  fill={c.failure}
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="system-ui, sans-serif"
                >
                  {lane.failReason}
                </text>
              )}

              <rect
                x={pos.node2.x - n2W / 2}
                y={pos.node2.y - NODE_HT / 2}
                width={n2W}
                height={NODE_HT}
                rx={RX}
                fill={nodeFill(n2)}
                stroke={nodeStroke(n2)}
                strokeWidth={n2Active ? 2 : 1.5}
                filter={n2Active ? 'url(#rl-glow-sm)' : undefined}
                style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
              />
              <text
                x={pos.node2.x}
                y={pos.node2.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={n2Active ? nodeStroke(n2) : c.text}
                fontSize={10}
                fontWeight={500}
                fontFamily="system-ui, sans-serif"
                style={{ transition: 'fill 200ms' }}
              >
                {lane.successNode}
              </text>

              <circle
                cx={pos.result.x}
                cy={pos.result.y}
                r={RESULT_R}
                fill={res === 'success' ? c.successFill : c.node}
                stroke={res === 'success' ? c.success : c.nodeBorder}
                strokeWidth={res === 'success' ? 2 : 1.5}
                filter={res === 'success' ? 'url(#rl-glow-sm)' : undefined}
                style={{ transition: 'fill 200ms, stroke 200ms' }}
              />
              <text
                x={pos.result.x}
                y={pos.result.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fill={res === 'success' ? c.success : c.textMuted}
                fontSize={res === 'success' ? 14 : 10}
                fontWeight={res === 'success' ? 700 : 400}
                fontFamily="system-ui, sans-serif"
                style={{ transition: 'fill 200ms' }}
              >
                {res === 'success' ? '✓' : '?'}
              </text>

              <circle
                ref={(el) => {
                  if (el) pulseRefs.current.set(`p-${idx}`, el);
                }}
                r={4}
                fill={c.pulse}
                opacity={0}
                filter="url(#rl-glow)"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSend}
          disabled={running}
          className={cn(
            'rounded-md px-4 py-1.5 text-xs font-medium transition-all duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
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
