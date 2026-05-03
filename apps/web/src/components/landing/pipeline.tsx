import { useInView } from '@/hooks/use-in-view';

const phases = [
  { label: 'Validate', detail: 'Standard Schema' },
  { label: 'Render', detail: 'React Email · template' },
  { label: 'Middleware', detail: 'rate-limit · retry · log' },
  { label: 'Transport', detail: 'SES · Resend · SMTP' },
  { label: 'Result', detail: 'messageId · attempts' },
] as const;

const notes = [
  {
    label: 'Hooks',
    body: (
      <>
        Observe without altering the send.{' '}
        <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
          onBeforeSend
        </code>
        ,{' '}
        <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
          onExecute
        </code>
        ,{' '}
        <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
          onAfterSend
        </code>
        ,{' '}
        <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
          onError
        </code>
        .
      </>
    ),
  },
  {
    label: 'Middleware',
    body: "Wrap, gate, retry, mutate. If removing it would change whether a message goes out, it's middleware, not a hook.",
  },
  {
    label: 'Transports',
    body: (
      <>
        Pluggable per-channel.{' '}
        <code className="bg-muted text-foreground rounded border px-1 py-0.5 font-mono text-xs">
          multiTransport
        </code>{' '}
        composes failover, round-robin, race, parallel, mirrored.
      </>
    ),
  },
] as const;

export function Pipeline() {
  const [ref, inView] = useInView();
  return (
    <section
      id="pipeline"
      className="border-border border-y bg-bn-slate-100 py-24 md:py-28 dark:bg-bn-slate-900"
    >
      <div
        ref={ref}
        className={`reveal mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">The pipeline</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            One flow. Every channel.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            Every send goes through the same five phases: input validation, render, middleware,
            transport, result. Hooks observe; middleware controls.
          </p>
        </div>

        <div className="border-border bg-card rounded-xl border p-5 md:p-7">
          <div className="mb-6 flex flex-wrap items-center gap-2.5">
            <code className="bg-muted text-foreground rounded border px-2.5 py-1.5 font-mono text-[13px] font-medium">
              mail.welcome.send()
            </code>
            <span className="text-muted-foreground font-mono text-[13px]">→</span>
            <code className="bg-muted text-foreground rounded border px-2.5 py-1.5 font-mono text-[13px] font-medium">
              SMTP · Gmail
            </code>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {phases.map((p) => (
              <div key={p.label} className="border-border-strong rounded-md border p-3 text-center">
                <div className="text-foreground font-mono text-[11px] font-medium uppercase tracking-wider">
                  {p.label}
                </div>
                <div className="text-muted-foreground mt-1 font-mono text-[11px]">{p.detail}</div>
              </div>
            ))}
          </div>

          <div
            className="border-border mt-5 grid gap-6 border-t pt-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
          >
            {notes.map((n) => (
              <div key={n.label}>
                <div className="text-muted-foreground mb-2 font-mono text-[11px] font-medium uppercase tracking-widest">
                  {n.label}
                </div>
                <p className="text-muted-foreground m-0 text-[13.5px] leading-relaxed text-pretty">
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
