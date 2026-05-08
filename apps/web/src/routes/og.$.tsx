import { createElement } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ImageResponse } from '@takumi-rs/image-response';

import { source } from '@/lib/source';
import { appConfig } from '@/lib/shared';

const FLOW_COLOR = 'rgb(107, 143, 199)';
const FLOW_BG = 'rgb(8, 11, 20)';
const NAVY_800 = '#1e2f4d';

const logoSvg = createElement(
  'svg',
  {
    viewBox: '0 0 191 177',
    fill: 'white',
    width: 36,
    height: 36,
    xmlns: 'http://www.w3.org/2000/svg',
  },
  createElement('path', {
    d: 'M162.011 20.0728V8.46658C162.011 3.79232 158.219 0 153.545 0H140.669C135.994 0 132.202 3.79232 132.202 8.46658V21.3428C132.202 26.0171 135.994 29.8094 140.669 29.8094H152.275C156.949 29.8094 160.741 33.6017 160.741 38.276V138.076C160.741 142.75 156.949 146.542 152.275 146.542H143.508C140.157 146.542 137.123 144.567 135.765 141.515L75.0527 5.02703C73.6945 1.97553 70.6606 0 67.3093 0H37.006C32.3317 0 28.5394 3.79232 28.5394 8.46658V20.0728C28.5394 24.7471 24.7471 28.5394 20.0728 28.5394H8.46658C3.79233 28.5394 0 32.3317 0 37.006V139.346C0 144.02 3.79233 147.812 8.46658 147.812H20.0728C24.7471 147.812 28.5394 151.605 28.5394 156.279V167.885C28.5394 172.559 32.3317 176.352 37.006 176.352H49.8822C54.5565 176.352 58.3488 172.559 58.3488 167.885V155.009C58.3488 150.335 54.5565 146.542 49.8822 146.542H38.276C33.6017 146.542 29.8094 142.75 29.8094 138.076V38.2936C29.8094 33.6194 33.6017 29.827 38.276 29.827H48.1713C51.5226 29.827 54.5565 31.8026 55.9147 34.8541L116.627 171.36C117.985 174.411 121.019 176.387 124.37 176.387H153.545C158.219 176.387 162.011 172.595 162.011 167.92V156.314C162.011 151.64 165.804 147.848 170.478 147.848H182.084C186.759 147.848 190.551 144.055 190.551 139.381V37.0236C190.551 32.3494 186.759 28.5571 182.084 28.5571H170.478C165.804 28.5571 162.011 24.7647 162.011 20.0905V20.0728Z',
  }),
);

const particles: { x: number; y: number; size: number; opacity: number }[] = [
  { x: 85, y: 42, size: 2.2, opacity: 0.35 },
  { x: 220, y: 95, size: 1.6, opacity: 0.2 },
  { x: 380, y: 28, size: 2.5, opacity: 0.28 },
  { x: 520, y: 130, size: 1.4, opacity: 0.18 },
  { x: 680, y: 55, size: 2.0, opacity: 0.32 },
  { x: 790, y: 180, size: 1.8, opacity: 0.22 },
  { x: 950, y: 72, size: 2.4, opacity: 0.3 },
  { x: 1050, y: 148, size: 1.5, opacity: 0.16 },
  { x: 1140, y: 35, size: 2.1, opacity: 0.26 },
  { x: 150, y: 290, size: 1.7, opacity: 0.24 },
  { x: 340, y: 340, size: 2.3, opacity: 0.2 },
  { x: 500, y: 280, size: 1.3, opacity: 0.15 },
  { x: 710, y: 320, size: 2.0, opacity: 0.28 },
  { x: 880, y: 260, size: 1.9, opacity: 0.22 },
  { x: 1020, y: 310, size: 1.6, opacity: 0.18 },
  { x: 1160, y: 250, size: 2.2, opacity: 0.25 },
  { x: 60, y: 440, size: 1.5, opacity: 0.17 },
  { x: 250, y: 480, size: 2.1, opacity: 0.3 },
  { x: 430, y: 420, size: 1.8, opacity: 0.21 },
  { x: 600, y: 510, size: 2.4, opacity: 0.26 },
  { x: 760, y: 450, size: 1.4, opacity: 0.14 },
  { x: 920, y: 490, size: 2.0, opacity: 0.32 },
  { x: 1080, y: 430, size: 1.7, opacity: 0.19 },
  { x: 170, y: 560, size: 2.3, opacity: 0.23 },
  { x: 460, y: 580, size: 1.6, opacity: 0.16 },
  { x: 830, y: 570, size: 2.1, opacity: 0.27 },
  { x: 1100, y: 590, size: 1.9, opacity: 0.2 },
  { x: 30, y: 160, size: 1.3, opacity: 0.12 },
  { x: 1170, y: 160, size: 1.4, opacity: 0.14 },
  { x: 640, y: 400, size: 2.5, opacity: 0.34 },
];

function ogLayout(title: string, description?: string) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        color: 'white',
        backgroundColor: FLOW_BG,
        position: 'relative',
        overflow: 'hidden',
      },
    },
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        bottom: '-180px',
        right: '-180px',
        width: '550px',
        height: '550px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${NAVY_800}40, transparent 70%)`,
      },
    }),
    createElement('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        top: '-80px',
        left: '-80px',
        width: '380px',
        height: '380px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${NAVY_800}25, transparent 70%)`,
      },
    }),
    ...particles.map((p, i) =>
      createElement('div', {
        key: i,
        style: {
          display: 'flex',
          position: 'absolute',
          left: `${p.x}px`,
          top: `${p.y}px`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: '50%',
          backgroundColor: FLOW_COLOR,
          opacity: p.opacity,
        },
      }),
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '56px 64px',
          position: 'relative',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        createElement(
          'p',
          {
            style: {
              fontWeight: 800,
              fontSize: '72px',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            },
          },
          title,
        ),
        description
          ? createElement(
              'p',
              {
                style: {
                  fontSize: '32px',
                  fontWeight: 400,
                  color: 'rgba(255, 255, 255, 0.55)',
                  margin: 0,
                  marginTop: '8px',
                  lineHeight: 1.4,
                  maxWidth: '800px',
                },
              },
              description,
            )
          : null,
      ),
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${NAVY_800}`,
            paddingTop: '24px',
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '14px',
            },
          },
          logoSvg,
          createElement(
            'p',
            {
              style: {
                fontSize: '24px',
                fontWeight: 600,
                margin: 0,
                color: 'white',
              },
            },
            appConfig.name,
          ),
        ),
        createElement(
          'p',
          {
            style: {
              fontSize: '18px',
              fontWeight: 400,
              margin: 0,
              color: 'white',
              letterSpacing: '0.02em',
            },
          },
          'better-notify.com',
        ),
      ),
    ),
  );
}

function renderOG(title: string, description?: string) {
  return new ImageResponse(ogLayout(title, description), {
    width: 1200,
    height: 630,
  });
}

export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET({ params }) {
        const raw = params._splat?.replace(/\/image\.png$/, '') ?? '';
        const prefix = 'docs/';

        if (raw === 'image.png') {
          return renderOG(appConfig.name, 'Typed notification infrastructure for Node.js');
        }

        if (!raw.startsWith(prefix)) {
          return new Response('Not found', { status: 404 });
        }

        const slugs = raw.slice(prefix.length).split('/');
        const page = source.getPage(slugs);

        if (!page) {
          return new Response('Not found', { status: 404 });
        }

        return renderOG(page.data.title, page.data.description as string | undefined);
      },
    },
  },
});
