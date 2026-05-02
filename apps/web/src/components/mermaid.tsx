import { renderMermaidSVG } from 'beautiful-mermaid';
import { useMemo } from 'react';
import { cn } from '@/lib/cn';

type MermaidProps = {
  code: string;
  title?: string;
  className?: string;
};

export function Mermaid({ code, title, className }: MermaidProps) {
  const { svg, error } = useMemo(() => {
    try {
      return {
        svg: renderMermaidSVG(code, {
          bg: 'var(--color-fd-background)',
          fg: 'var(--color-fd-foreground)',
          line: 'var(--color-fd-foreground)',
          accent: 'var(--color-fd-primary)',
          muted: 'var(--color-fd-muted-foreground)',
          surface: 'var(--color-fd-card)',
          border: 'var(--color-fd-border)',
          transparent: true,
          font: 'ui-sans-serif, system-ui, sans-serif',
          padding: 24,
        }),
        error: null,
      };
    } catch (err) {
      return {
        svg: null,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }, [code]);

  if (!svg || error) {
    return (
      <pre
        className="overflow-x-auto rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: 'var(--color-fd-border)',
          backgroundColor: 'var(--color-fd-card)',
          color: 'var(--color-fd-foreground)',
        }}
      >
        {error?.message ?? 'Error rendering Mermaid diagram'}
      </pre>
    );
  }

  return (
    <figure className={cn('my-6', className)}>
      {title ? (
        <figcaption className="mb-3 text-sm" style={{ color: 'var(--color-fd-muted-foreground)' }}>
          {title}
        </figcaption>
      ) : null}

      <div
        className="overflow-x-auto rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-fd-border)',
          backgroundColor: 'color-mix(in oklab, var(--color-fd-card) 65%, transparent)',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </figure>
  );
}
