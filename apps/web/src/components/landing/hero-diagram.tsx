import { useReducedMotion } from '@/hooks/use-reduced-motion';

function DiagramNode({
  x,
  y,
  w,
  label,
  detail,
  active,
  subtle,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  detail: string;
  active?: boolean;
  subtle?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={48}
        rx="6"
        fill={active ? 'var(--color-bn-primary-subtle)' : 'var(--background)'}
        stroke={active ? 'var(--primary)' : 'var(--border)'}
        strokeWidth="1"
        style={{ opacity: subtle ? 0.6 : 1 }}
      />
      <text
        x={x + w / 2}
        y={y + 20}
        textAnchor="middle"
        fill={active ? 'var(--primary)' : 'var(--muted-foreground)'}
        style={{
          font: '500 11px var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </text>
      <text
        x={x + w / 2}
        y={y + 36}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        style={{ font: '400 10px var(--font-mono)' }}
      >
        {detail}
      </text>
    </g>
  );
}

function DiagramWire({
  from,
  to,
  active,
  animate,
}: {
  from: [number, number];
  to: [number, number];
  active?: boolean;
  animate?: boolean;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={active ? 'var(--primary)' : 'var(--border)'}
        strokeWidth="1.2"
        strokeDasharray="3 4"
        opacity={active ? 0.6 : 0.35}
      />
      {active && animate && (
        <circle r="3" fill="var(--primary)" opacity="0.8">
          <animateMotion dur="2s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  );
}

export function HeroDiagram() {
  const animate = !useReducedMotion();
  return (
    <svg viewBox="0 0 480 220" className="block w-full" style={{ height: 'auto' }}>
      <DiagramNode x={20} y={90} w={110} label="Catalog" detail="welcome.send" active />
      <DiagramNode x={170} y={20} w={130} label="rateLimit" detail="middleware" active subtle />
      <DiagramNode x={170} y={90} w={130} label="render" detail="React Email" active />
      <DiagramNode x={170} y={160} w={130} label="retry" detail="middleware" subtle />
      <DiagramNode x={340} y={90} w={120} label="SMTP" detail="transport" active />
      <DiagramWire from={[130, 110]} to={[170, 50]} active animate={animate} />
      <DiagramWire from={[130, 110]} to={[170, 110]} active animate={animate} />
      <DiagramWire from={[130, 110]} to={[170, 180]} />
      <DiagramWire from={[300, 110]} to={[340, 110]} active animate={animate} />
    </svg>
  );
}
