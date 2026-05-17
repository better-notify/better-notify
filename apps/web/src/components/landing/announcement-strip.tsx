import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, WhatsappLogo } from '@phosphor-icons/react';
import { ModelContextProtocol } from '@libs/ui';
import { useAnalytics } from '@/hooks/use-analytics';

const announcements = [
  {
    id: 'mcp',
    href: '/mcp',
    icon: (
      <ModelContextProtocol
        width={14}
        height={14}
        className="shrink-0 fill-[oklch(78%_0.10_258)]"
      />
    ),
    label: 'MCP support is here:',
    text: 'let AI agents discover and send notifications through your typed catalog',
    bg: 'bg-[oklch(18%_0.03_258)]',
    glow: 'oklch(55% 0.12 258)',
  },
  {
    id: 'whatsapp',
    href: '/docs/channels/whatsapp',
    icon: <WhatsappLogo size={15} weight="fill" className="shrink-0 text-[oklch(78%_0.14_155)]" />,
    label: 'WhatsApp is here:',
    text: 'send templates, media, and interactive messages through Meta Cloud API',
    bg: 'bg-[oklch(22%_0.04_155)]',
    glow: 'oklch(60% 0.15 155)',
  },
] as const;

export function AnnouncementStrip() {
  const analytics = useAnalytics('announcement');
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const timeoutRef = useRef<number>(undefined);

  const advance = useCallback(() => {
    setTransitioning(true);
    timeoutRef.current = window.setTimeout(() => {
      setIndex((i) => (i + 1) % announcements.length);
      setTransitioning(false);
    }, 300);
  }, []);

  useEffect(() => {
    const timer = setInterval(advance, 5000);
    return () => {
      clearInterval(timer);
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [advance]);

  const current = announcements[index];

  return (
    <div
      className={`relative overflow-hidden text-white transition-colors duration-300 ${current.bg}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20 transition-all duration-300"
        style={{
          backgroundImage: `radial-gradient(ellipse 50% 100% at 50% 0%, ${current.glow}, transparent)`,
        }}
      />
      <a
        href={current.href}
        onClick={() => analytics.track(current.id).action('click', { destination: current.href })}
        className={`group relative mx-auto flex max-w-[1200px] items-center justify-center gap-2.5 px-5 py-2.5 text-center text-[13px] font-medium text-white/90 no-underline transition-all duration-300 hover:text-white ${
          transitioning ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        {current.icon}
        <span>
          <span className="font-semibold text-white">{current.label}</span> {current.text}
        </span>
        <ArrowRight
          size={12}
          weight="bold"
          className="shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </a>
    </div>
  );
}
