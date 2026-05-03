import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type FlowFieldBackgroundProps = {
  className?: string;
  particleCount?: number;
  speed?: number;
};

type ParticleKind = 'email' | 'sms' | 'bell' | 'webhook' | 'dot';

type Particle = {
  x: number;
  y: number;
  speed: number;
  kind: ParticleKind;
  size: number;
  opacity: number;
  drift: number;
  driftSpeed: number;
  driftOffset: number;
  rotation: number;
};

function createParticle(width: number, height: number, offscreen: boolean): Particle {
  const r = Math.random();
  const kind: ParticleKind =
    r < 0.25 ? 'email' : r < 0.45 ? 'sms' : r < 0.6 ? 'bell' : r < 0.72 ? 'webhook' : 'dot';
  const speed = 0.12 + Math.random() * 0.4;
  const size = kind === 'dot' ? 1.2 + Math.random() * 1.3 : 10 + Math.random() * 6;

  return {
    x: offscreen
      ? -size * 2 - Math.random() * width * 0.5
      : Math.random() * (width + size * 4) - size * 2,
    y: Math.random() * height,
    speed,
    kind,
    size,
    opacity: 0.12 + Math.random() * 0.32,
    drift: 6 + Math.random() * 10,
    driftSpeed: 0.2 + Math.random() * 0.4,
    driftOffset: Math.random() * Math.PI * 2,
    rotation: (Math.random() - 0.5) * 0.15,
  };
}

function drawEmail(ctx: CanvasRenderingContext2D, s: number, color: string) {
  const w = s;
  const h = s * 0.65;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(0, 0);
  ctx.lineTo(w / 2, -h / 2);
  ctx.stroke();
}

function drawSms(ctx: CanvasRenderingContext2D, s: number, color: string) {
  const w = s;
  const h = s * 0.65;
  const tailH = s * 0.18;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h / 2);
  ctx.lineTo(-w * 0.35, h / 2 + tailH);
  ctx.lineTo(-w * 0.05, h / 2);
  ctx.stroke();

  ctx.fillStyle = color;
  const dotR = 0.9;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(i * w * 0.17, 0, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBell(ctx: CanvasRenderingContext2D, s: number, color: string) {
  const bellW = s * 0.65;
  const bellH = s * 0.55;
  const topY = -bellH / 2 - s * 0.1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(-bellW / 2, bellH / 2);
  ctx.quadraticCurveTo(-bellW / 2, topY + bellH * 0.15, 0, topY);
  ctx.quadraticCurveTo(bellW / 2, topY + bellH * 0.15, bellW / 2, bellH / 2);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-bellW / 2 - s * 0.08, bellH / 2);
  ctx.lineTo(bellW / 2 + s * 0.08, bellH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, bellH / 2 + s * 0.1, s * 0.09, 0, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, topY);
  ctx.lineTo(0, topY - s * 0.1);
  ctx.stroke();
}

function drawWebhook(ctx: CanvasRenderingContext2D, s: number, color: string) {
  const w = s * 0.9;
  const h = s * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(-w / 2 + w * 0.25, -h / 2);
  ctx.lineTo(-w / 2, 0);
  ctx.lineTo(-w / 2 + w * 0.25, h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w / 2 - w * 0.25, -h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w / 2 - w * 0.25, h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.08, -h * 0.35);
  ctx.lineTo(-w * 0.08, h * 0.35);
  ctx.stroke();
}

function readFlowColors(container: HTMLElement) {
  const style = getComputedStyle(container);
  return {
    color: `rgb(${style.getPropertyValue('--flow-field-color').trim()})`,
    bgColor: style.getPropertyValue('--flow-field-bg').trim(),
  };
}

export function FlowFieldBackground({
  className,
  particleCount = 300,
  speed = 1,
}: FlowFieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef({ color: '', bgColor: '' });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    colorsRef.current = readFlowColors(container);

    let width = container.clientWidth;
    let height = container.clientHeight;
    let particles: Particle[] = [];
    let animationFrameId: number;
    let time = 0;

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle(width, height, false));
      }
    };

    const drawStatic = () => {
      const { color, bgColor } = colorsRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${bgColor})`;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        const edgeFadeL = Math.min(p.x / (width * 0.12), 1);
        const edgeFadeR = Math.min((width - p.x) / (width * 0.12), 1);
        const alpha = Math.max(0, p.opacity * Math.min(edgeFadeL, edgeFadeR));
        if (alpha <= 0) continue;

        if (p.kind === 'dot') {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;

        switch (p.kind) {
          case 'email':
            drawEmail(ctx, p.size, color);
            break;
          case 'sms':
            drawSms(ctx, p.size, color);
            break;
          case 'bell':
            drawBell(ctx, p.size, color);
            break;
          case 'webhook':
            drawWebhook(ctx, p.size, color);
            break;
        }

        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const animate = () => {
      time += 0.016;
      const { color, bgColor } = colorsRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${bgColor})`;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.speed * speed;

        if (p.x > width + p.size * 2 + 10) {
          Object.assign(p, createParticle(width, height, true));
        }

        const yOffset = Math.sin(time * p.driftSpeed + p.driftOffset) * p.drift;
        const drawY = p.y + yOffset;

        const edgeFadeL = Math.min(p.x / (width * 0.12), 1);
        const edgeFadeR = Math.min((width - p.x) / (width * 0.12), 1);
        const alpha = Math.max(0, p.opacity * Math.min(edgeFadeL, edgeFadeR));
        if (alpha <= 0) continue;

        if (p.kind === 'dot') {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, drawY, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        ctx.save();
        ctx.translate(p.x, drawY);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;

        switch (p.kind) {
          case 'email':
            drawEmail(ctx, p.size, color);
            break;
          case 'sms':
            drawSms(ctx, p.size, color);
            break;
          case 'bell':
            drawBell(ctx, p.size, color);
            break;
          case 'webhook':
            drawWebhook(ctx, p.size, color);
            break;
        }

        ctx.restore();
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(animate);
    };

    const observer = new MutationObserver(() => {
      colorsRef.current = readFlowColors(container);
      if (reducedMotion) drawStatic();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const handleResize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      colorsRef.current = readFlowColors(container);
      init();
      if (reducedMotion) drawStatic();
    };

    init();

    if (reducedMotion) {
      drawStatic();
    } else {
      animate();
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [particleCount, speed, reducedMotion]);

  return (
    <div ref={containerRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
