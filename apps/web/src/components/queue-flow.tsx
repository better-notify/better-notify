'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/cn';

const VW = 680;
const VH = 155;
const TRAVEL_MS = 400;
const NODE_PAUSE_MS = 220;
const SETTLE_MS = 600;

type Point = { x: number; y: number };
type NodeVisual = 'idle' | 'active' | 'success';

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
    successFill: 'oklch(95% 0.04 155)',
    failFill: 'oklch(95% 0.04 27)',
    activeFill: 'oklch(95% 0.04 75)',
    storeFill: 'oklch(96% 0.012 75)',
    storeBorder: 'oklch(72% 0.03 75)',
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
    successFill: 'oklch(25% 0.06 155)',
    failFill: 'oklch(22% 0.06 27)',
    activeFill: 'oklch(25% 0.05 75)',
    storeFill: 'oklch(22% 0.012 75)',
    storeBorder: 'oklch(42% 0.03 75)',
  },
} as const;

const POS = {
  source: { x: 42, y: 78 },
  enqueue: { x: 138, y: 78 },
  store: { x: 240, y: 78 },
  worker: { x: 392, y: 42 },
  handler: { x: 392, y: 114 },
  process: { x: 528, y: 78 },
  ack: { x: 640, y: 34 },
  retry: { x: 640, y: 78 },
  dlq: { x: 640, y: 122 },
};

type WireDef = {
  id: string;
  from: Point;
  to: Point;
  label?: string;
  labelT?: number;
  labelOffsetY?: number;
};

const WIRES: WireDef[] = [
  { id: 'w0', from: POS.source, to: POS.enqueue },
  { id: 'w1', from: POS.enqueue, to: POS.store },
  { id: 'w2', from: POS.store, to: POS.worker, label: 'pull', labelT: 0.4, labelOffsetY: -9 },
  { id: 'w3', from: POS.store, to: POS.handler, label: 'push', labelT: 0.4, labelOffsetY: 9 },
  { id: 'w4', from: POS.worker, to: POS.process },
  { id: 'w5', from: POS.handler, to: POS.process },
  { id: 'w6', from: POS.process, to: POS.ack },
  { id: 'w7', from: POS.process, to: POS.retry },
  { id: 'w8', from: POS.process, to: POS.dlq },
];

const WIRE_LABELS = WIRES.filter((w) => w.label);

type RectNodeDef = { pos: Point; label: string };

const RECT_NODES: RectNodeDef[] = [
  { pos: POS.enqueue, label: 'enqueue' },
  { pos: POS.worker, label: 'createQueueWorker' },
  { pos: POS.handler, label: 'handler' },
  { pos: POS.process, label: 'process' },
];

type OutcomeKind = 'success' | 'retry' | 'failure';
type OutcomeDef = { pos: Point; label: string; kind: OutcomeKind };

const OUTCOMES: OutcomeDef[] = [
  { pos: POS.ack, label: 'ack', kind: 'success' },
  { pos: POS.retry, label: 'retry', kind: 'retry' },
  { pos: POS.dlq, label: 'dlq', kind: 'failure' },
];

type WireSettle = 'success' | 'retry' | 'fail';

type AnimStep = {
  wire: string;
  settle: WireSettle;
  activateStore?: boolean;
  nodeIdx?: number;
  outcomeIdx?: number;
};

const SHARED_STEPS: AnimStep[] = [
  { wire: 'w0', settle: 'success', nodeIdx: 0 },
  { wire: 'w1', settle: 'success', activateStore: true },
  { wire: 'w2', settle: 'success', nodeIdx: 1 },
  { wire: 'w4', settle: 'success', nodeIdx: 3 },
];

type ScenarioKey = 'ack' | 'retry' | 'dlq';

type ScenarioDef = {
  key: ScenarioKey;
  label: string;
  outcomeIdx: number;
  terminalWire: string;
  terminalSettle: WireSettle;
  requeue: boolean;
  status: string;
};

const SCENARIOS: ScenarioDef[] = [
  {
    key: 'ack',
    label: 'Delivered',
    outcomeIdx: 0,
    terminalWire: 'w6',
    terminalSettle: 'success',
    requeue: false,
    status:
      'Delivered. The transport accepted the message, so the worker acks the job and the store drops it.',
  },
  {
    key: 'retry',
    label: 'Retried',
    outcomeIdx: 1,
    terminalWire: 'w7',
    terminalSettle: 'retry',
    requeue: true,
    status: 'Transient error. The job returns to the store, pending another attempt with backoff.',
  },
  {
    key: 'dlq',
    label: 'Failed',
    outcomeIdx: 2,
    terminalWire: 'w8',
    terminalSettle: 'fail',
    requeue: false,
    status:
      'Terminal failure. The job is parked in the dead-letter store; replaying it cannot help.',
  },
];

const STORE_CAPTION =
  'The store is the durable queue backend (Postgres, Redis, SQS, Cloudflare Queues) that holds each job between enqueue and pickup.';

const IDLE_STATUS = 'Pick an outcome to trace a job through the pipeline.';

const CHAR_W = 6.2;
const NODE_W_MIN = 60;
const NODE_H = 28;
const NODE_RX = 10;
const STORE_W = 68;
const STORE_H = 32;
const STORE_ERY = 6;

export function QueueFlow() {
  const dark = useTheme();
  const reducedMotion = useReducedMotion();
  const c = dark ? palette.dark : palette.light;

  const [storeState, setStoreState] = useState<NodeVisual>('idle');
  const [nodeStates, setNodeStates] = useState<NodeVisual[]>(() => RECT_NODES.map(() => 'idle'));
  const [outcomeStates, setOutcomeStates] = useState<NodeVisual[]>(() =>
    OUTCOMES.map(() => 'idle'),
  );
  const [activeWires, setActiveWires] = useState<Set<string>>(new Set());
  const [settledWires, setSettledWires] = useState<Map<string, WireSettle>>(new Map());
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  const [running, setRunning] = useState(false);

  const abortRef = useRef({ aborted: false });
  const pulseRef = useRef<SVGCircleElement | null>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());

  useEffect(
    () => () => {
      abortRef.current.aborted = true;
    },
    [],
  );

  const resetVisuals = useCallback(() => {
    setStoreState('idle');
    setNodeStates(RECT_NODES.map(() => 'idle'));
    setOutcomeStates(OUTCOMES.map(() => 'idle'));
    setActiveWires(new Set());
    setSettledWires(new Map());
    if (pulseRef.current) pulseRef.current.setAttribute('opacity', '0');
  }, []);

  const animatePulse = useCallback(
    (wireId: string, duration: number): Promise<boolean> => {
      const pulseEl = pulseRef.current;
      const pathEl = pathRefs.current.get(wireId);
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

  const handleRun = useCallback(
    async (sc: ScenarioDef) => {
      if (running) return;
      setRunning(true);
      setScenario(sc.key);
      abortRef.current = { aborted: false };
      resetVisuals();
      await wait(80);
      const abort = abortRef.current;

      const terminalStep: AnimStep = {
        wire: sc.terminalWire,
        settle: sc.terminalSettle,
        outcomeIdx: sc.outcomeIdx,
      };

      for (const step of [...SHARED_STEPS, terminalStep]) {
        if (abort.aborted) break;

        setActiveWires((prev) => new Set([...prev, step.wire]));
        const ok = await animatePulse(step.wire, TRAVEL_MS);
        if (!ok) break;

        const wireId = step.wire;
        const settle = step.settle;
        setSettledWires((prev) => new Map(prev).set(wireId, settle));
        setActiveWires((prev) => {
          const next = new Set(prev);
          next.delete(wireId);
          return next;
        });

        if (step.activateStore) {
          setStoreState('active');
          if (!(await wait(NODE_PAUSE_MS, abort))) break;
          setStoreState('success');
        }

        if (step.nodeIdx !== undefined) {
          const idx = step.nodeIdx;
          setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'active' : s)));
          if (!(await wait(NODE_PAUSE_MS, abort))) break;
          setNodeStates((prev) => prev.map((s, i) => (i === idx ? 'success' : s)));
        }

        if (step.outcomeIdx !== undefined) {
          const idx = step.outcomeIdx;
          setOutcomeStates((prev) => prev.map((s, i) => (i === idx ? 'success' : s)));
        }
      }

      if (sc.requeue && !abort.aborted) {
        await wait(NODE_PAUSE_MS, abort);
        if (!abort.aborted) setStoreState('active');
      }

      if (pulseRef.current) pulseRef.current.setAttribute('opacity', '0');
      await wait(SETTLE_MS);
      setRunning(false);
    },
    [running, resetVisuals, animatePulse],
  );

  const settleColor: Record<WireSettle, string> = {
    success: c.success,
    retry: c.wireActive,
    fail: c.failure,
  };

  const wireColor = (id: string) => {
    const settled = settledWires.get(id);
    if (settled) return settleColor[settled];
    if (activeWires.has(id)) return c.wireActive;
    return c.wire;
  };

  const wireLit = (id: string) => settledWires.has(id) || activeWires.has(id);

  const wireWidth = (id: string) => (wireLit(id) ? 2.5 : 1.5);

  const wireOpacity = (id: string) => (wireLit(id) ? 1 : 0.5);

  const scenarioColor = (key: ScenarioKey) =>
    key === 'ack' ? c.success : key === 'retry' ? c.wireActive : c.failure;

  const activeScenario = SCENARIOS.find((s) => s.key === scenario);
  const statusText = activeScenario ? activeScenario.status : IDLE_STATUS;
  const statusDotColor = activeScenario ? scenarioColor(activeScenario.key) : c.textMuted;

  const nodeStroke = (state: NodeVisual) => {
    if (state === 'success') return c.success;
    if (state === 'active') return c.wireActive;
    return c.nodeBorder;
  };

  const nodeFill = (state: NodeVisual) => {
    if (state === 'success') return c.successFill;
    if (state === 'active') return c.activeFill;
    return c.node;
  };

  const outcomeStrokeColor = (state: NodeVisual, kind: OutcomeKind) => {
    if (state !== 'success') return c.nodeBorder;
    if (kind === 'success') return c.success;
    if (kind === 'retry') return c.wireActive;
    return c.failure;
  };

  const outcomeFillColor = (state: NodeVisual, kind: OutcomeKind) => {
    if (state !== 'success') return c.node;
    if (kind === 'success') return c.successFill;
    if (kind === 'retry') return c.activeFill;
    return c.failFill;
  };

  const storeCx = POS.store.x;
  const storeCy = POS.store.y;
  const storeRx = STORE_W / 2;
  const storeTopY = storeCy - STORE_H / 2;
  const storeBotY = storeCy + STORE_H / 2;
  const storeIsActive = storeState !== 'idle';
  const storeStrokeColor =
    storeState === 'success' ? c.success : storeState === 'active' ? c.wireActive : c.storeBorder;
  const storeFillColor =
    storeState === 'success' ? c.successFill : storeState === 'active' ? c.activeFill : c.storeFill;
  const storeSw = storeIsActive ? 2 : 1.5;
  const storeFilterId = storeIsActive ? 'url(#qf-glow-sm)' : undefined;
  const storeTrans = { transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' };

  return (
    <div className="not-prose">
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full select-none"
          style={{ maxHeight: '220px' }}
          role="img"
          aria-label="Queue flow: enqueue to store, pull or push consumer, process, then ack, retry, or dead-letter"
        >
          <defs>
            <filter id="qf-glow-sm" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {WIRES.map((wire) => (
            <path
              key={wire.id}
              ref={(el) => {
                if (el) pathRefs.current.set(wire.id, el);
              }}
              d={curvePath(wire.from, wire.to)}
              fill="none"
              stroke={wireColor(wire.id)}
              strokeWidth={wireWidth(wire.id)}
              opacity={wireOpacity(wire.id)}
              style={{ transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms' }}
            />
          ))}

          <g>
            <circle
              cx={POS.source.x}
              cy={POS.source.y}
              r={18}
              fill={c.node}
              stroke={c.nodeBorder}
              strokeWidth={1.5}
            />
            <text
              x={POS.source.x}
              y={POS.source.y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill={c.text}
              fontSize={9}
              fontWeight={500}
              fontFamily="system-ui, sans-serif"
            >
              queue
            </text>
          </g>

          <g>
            <path
              d={`M ${storeCx - storeRx} ${storeTopY + STORE_ERY} V ${storeBotY - STORE_ERY} A ${storeRx} ${STORE_ERY} 0 0 0 ${storeCx + storeRx} ${storeBotY - STORE_ERY} V ${storeTopY + STORE_ERY} Z`}
              fill={storeFillColor}
              stroke="none"
            />
            <path
              d={`M ${storeCx - storeRx} ${storeTopY + STORE_ERY} V ${storeBotY - STORE_ERY} A ${storeRx} ${STORE_ERY} 0 0 0 ${storeCx + storeRx} ${storeBotY - STORE_ERY} V ${storeTopY + STORE_ERY}`}
              fill="none"
              stroke={storeStrokeColor}
              strokeWidth={storeSw}
              filter={storeFilterId}
              style={storeTrans}
            />
            <ellipse
              cx={storeCx}
              cy={storeTopY + STORE_ERY}
              rx={storeRx}
              ry={STORE_ERY}
              fill={storeFillColor}
              stroke={storeStrokeColor}
              strokeWidth={storeSw}
              filter={storeFilterId}
              style={storeTrans}
            />
            <text
              x={storeCx}
              y={storeCy + 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={storeIsActive ? storeStrokeColor : c.text}
              fontSize={10}
              fontWeight={500}
              fontFamily="system-ui, sans-serif"
              style={{ transition: 'fill 200ms' }}
            >
              store
            </text>
          </g>

          {RECT_NODES.map((node, idx) => {
            const state = nodeStates[idx];
            const active = state !== 'idle';
            const w = Math.max(NODE_W_MIN, node.label.length * CHAR_W + 20);

            return (
              <g key={node.label}>
                <rect
                  x={node.pos.x - w / 2}
                  y={node.pos.y - NODE_H / 2}
                  width={w}
                  height={NODE_H}
                  rx={NODE_RX}
                  ry={NODE_RX}
                  fill={nodeFill(state)}
                  stroke={nodeStroke(state)}
                  strokeWidth={active ? 2 : 1.5}
                  filter={active ? 'url(#qf-glow-sm)' : undefined}
                  style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
                />
                <text
                  x={node.pos.x}
                  y={node.pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={active ? nodeStroke(state) : c.text}
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

          {OUTCOMES.map((outcome, idx) => {
            const state = outcomeStates[idx];
            const active = state !== 'idle';
            const w = Math.max(42, outcome.label.length * CHAR_W + 18);
            const stroke = outcomeStrokeColor(state, outcome.kind);
            const fill = outcomeFillColor(state, outcome.kind);

            return (
              <g key={outcome.label}>
                <rect
                  x={outcome.pos.x - w / 2}
                  y={outcome.pos.y - NODE_H / 2}
                  width={w}
                  height={NODE_H}
                  rx={NODE_RX}
                  ry={NODE_RX}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={active ? 2 : 1.5}
                  filter={active ? 'url(#qf-glow-sm)' : undefined}
                  style={{ transition: 'fill 200ms, stroke 200ms, stroke-width 200ms' }}
                />
                <text
                  x={outcome.pos.x}
                  y={outcome.pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={active ? stroke : c.textMuted}
                  fontSize={10}
                  fontWeight={active ? 600 : 500}
                  fontFamily="system-ui, sans-serif"
                  style={{ transition: 'fill 200ms' }}
                >
                  {outcome.label}
                </text>
              </g>
            );
          })}

          {WIRE_LABELS.map((wire) => {
            const t = wire.labelT ?? 0.5;
            return (
              <text
                key={`label-${wire.id}`}
                x={wire.from.x + (wire.to.x - wire.from.x) * t}
                y={wire.from.y + (wire.to.y - wire.from.y) * t + (wire.labelOffsetY ?? 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill={c.textMuted}
                fontSize={8.5}
                fontWeight={500}
                fontFamily="system-ui, sans-serif"
              >
                {wire.label}
              </text>
            );
          })}
        </svg>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="pointer-events-none absolute left-0 top-0 w-full select-none"
          style={{ maxHeight: '220px' }}
          aria-hidden="true"
        >
          <defs>
            <filter id="qf-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle ref={pulseRef} r={5} fill={c.pulse} opacity={0} filter="url(#qf-glow)" />
        </svg>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          {SCENARIOS.map((sc) => {
            const selected = scenario === sc.key;
            const accent = scenarioColor(sc.key);
            return (
              <button
                key={sc.key}
                onClick={() => handleRun(sc)}
                disabled={running}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                style={{
                  background: selected ? accent : 'transparent',
                  color: selected ? (dark ? 'oklch(15% 0.005 75)' : 'oklch(99% 0.005 75)') : c.text,
                  border: `1px solid ${selected ? accent : c.nodeBorder}`,
                  outlineColor: accent,
                }}
              >
                {sc.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-start gap-2 text-xs" style={{ color: c.text }}>
          <span
            className="mt-1 inline-block size-2 shrink-0 rounded-full"
            style={{ background: statusDotColor, transition: 'background 200ms' }}
            aria-hidden="true"
          />
          <span>{statusText}</span>
        </div>

        <p className="text-xs" style={{ color: c.textMuted }}>
          {STORE_CAPTION}
        </p>
      </div>
    </div>
  );
}
