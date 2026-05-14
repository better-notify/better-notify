import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

import appCss from '@/styles/app.css?url';
import { appConfig, GOOGLE_ANALYTICS_ID } from '@/lib/shared';
import { seo } from '@/lib/seo';
import { usePosthogInit } from '@/hooks/use-posthog-client';

function Providers({ children }: { children: ReactNode }) {
  usePosthogInit();
  return <RootProvider theme={{ disableTransitionOnChange: true }}>{children}</RootProvider>;
}

export const Route = createRootRoute({
  head: () => {
    const { meta: seoMeta, links: seoLinks } = seo({
      title: `${appConfig.name}: Typed Notifications for Node.js, Bun, Cloudflare Workers, and Vercel`,
      description:
        'Typed notifications for Node.js, Bun, Cloudflare Workers, and Vercel. Send email, SMS, Telegram, Slack, and Discord from one typed catalog with full TypeScript support.',
      keywords:
        'better-notify, betternotify, typed notifications, notification library nodejs, notification library bun, notification library cloudflare workers, notification library vercel, notification infrastructure, transactional email nodejs, transactional email bun, transactional email cloudflare workers, transactional email vercel, send email nodejs, send email bun, send email cloudflare workers, send email vercel, sms nodejs, telegram bot nodejs, slack notifications, discord webhooks, multi-channel notifications, typescript notifications, notification sdk, smtp nodejs, resend, cloudflare email, twilio sms, mailchimp transactional, type-safe api, notification catalog',
      image: `${appConfig.baseUrl}/og/image.png`,
    });

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'application-name', content: appConfig.name },
        ...seoMeta,
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        ...seoLinks,
      ],
      scripts: [
        {
          children: `
            (function() {
              function loadGA() {
                var script = document.createElement('script');
                script.src = 'https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}';
                script.async = true;
                document.head.appendChild(script);

                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ANALYTICS_ID}');
              }

              if ('requestIdleCallback' in window) {
                requestIdleCallback(loadGA, { timeout: 3000 });
              } else {
                setTimeout(loadGA, 2000);
              }
            })();
          `,
        },
      ],
    };
  },
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang={appConfig.locale.bcp47} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Outlet />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
