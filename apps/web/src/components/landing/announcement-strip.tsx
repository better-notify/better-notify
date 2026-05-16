import { WhatsappLogo, ArrowRight } from '@phosphor-icons/react';
import { useAnalytics } from '@/hooks/use-analytics';

export function AnnouncementStrip() {
  const analytics = useAnalytics('announcement');

  return (
    <div className="relative overflow-hidden bg-[oklch(22%_0.04_155)] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 100% at 50% 0%, oklch(60% 0.15 155), transparent)',
        }}
      />
      <a
        href="/docs/channels/whatsapp"
        onClick={() =>
          analytics.track('whatsapp').action('click', { destination: '/docs/channels/whatsapp' })
        }
        className="relative mx-auto flex max-w-[1200px] items-center justify-center gap-2.5 px-5 py-2.5 text-center text-[13px] font-medium text-white/90 no-underline transition-colors hover:text-white"
      >
        <WhatsappLogo size={15} weight="fill" className="shrink-0 text-[oklch(78%_0.14_155)]" />
        <span>
          <span className="font-semibold text-white">WhatsApp is here:</span> send templates, media,
          and interactive messages through Meta Cloud API
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
