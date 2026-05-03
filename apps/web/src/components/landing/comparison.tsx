import { useInView } from '@/hooks/use-in-view';

type Cell = string | { v: string; muted?: boolean; bn?: boolean };

const rows: [string, Cell, Cell, Cell][] = [
  ['Lives in your codebase', { v: '— dashboard', muted: true }, { v: '✓' }, { v: '✓', bn: true }],
  [
    'End-to-end typed call sites',
    { v: '— stringly-typed', muted: true },
    { v: 'partial' },
    { v: '✓ catalog → sender', bn: true },
  ],
  [
    'Multi-provider failover',
    { v: '✓ vendor-locked' },
    { v: '— DIY', muted: true },
    { v: '✓ multiTransport()', bn: true },
  ],
  [
    'Multi-channel from one route',
    { v: 'varies' },
    { v: '— DIY', muted: true },
    { v: '✓ shared pipeline', bn: true },
  ],
  [
    'Validation before side effects',
    { v: 'partial' },
    { v: '— DIY', muted: true },
    { v: '✓ Standard Schema', bn: true },
  ],
  ['Vendor lock-in', { v: 'high', muted: true }, { v: 'none' }, { v: 'none', bn: true }],
  ['Pricing model', { v: 'per-send' }, { v: 'free' }, { v: 'free · MIT', bn: true }],
];

function cellValue(cell: Cell) {
  return typeof cell === 'string' ? cell : cell.v;
}
function isMuted(cell: Cell) {
  return typeof cell !== 'string' && cell.muted;
}
function isBn(cell: Cell) {
  return typeof cell !== 'string' && cell.bn;
}

export function Comparison() {
  const [ref, inView] = useInView();
  return (
    <section id="compare" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`reveal mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">Comparison</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            When to reach for it.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            Better-Notify sits between cloud notification platforms and a hand-rolled sendEmail()
            helper.
          </p>
        </div>

        <div className="border-border bg-card overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-border bg-muted/50 text-muted-foreground border-b px-4 py-3.5 text-left font-sans text-[11px] font-semibold uppercase tracking-wider" />
                <th className="border-border bg-muted/50 text-muted-foreground border-b px-4 py-3.5 text-left font-sans text-[11px] font-semibold uppercase tracking-wider">
                  Cloud platforms
                </th>
                <th className="border-border bg-muted/50 text-muted-foreground border-b px-4 py-3.5 text-left font-sans text-[11px] font-semibold uppercase tracking-wider">
                  Hand-rolled
                </th>
                <th className="border-border text-primary bg-primary/5 border-b px-4 py-3.5 text-left font-sans text-[11px] font-semibold uppercase tracking-wider">
                  Better-Notify
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]}>
                  <td className="border-border text-foreground border-b px-4 py-3.5 text-[13.5px] font-semibold">
                    {row[0]}
                  </td>
                  {([row[1], row[2], row[3]] as Cell[]).map((cell, i) => (
                    <td
                      key={i}
                      className={`border-border border-b px-4 py-3.5 text-[13px] ${
                        isBn(cell) ? 'bg-primary/5' : ''
                      } ${isMuted(cell) ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      {cellValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
