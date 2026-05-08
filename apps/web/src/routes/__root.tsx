import type { ReactNode } from 'react';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';
import { PostHogProvider } from '@posthog/react';

import appCss from '@/styles/app.css?url';
import { appConfig, GOOGLE_ANALYTICS_ID } from '@/lib/shared';
import { seo } from '@/lib/seo';
import { usePosthogClient } from '@/hooks/use-posthog-client';

function BaseProviders({ children }: { children: ReactNode }) {
  return <RootProvider theme={{ disableTransitionOnChange: true }}>{children}</RootProvider>;
}

function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { client } = usePosthogClient();

  if (!client) {
    return <BaseProviders>{children}</BaseProviders>;
  }

  return (
    <PostHogProvider client={client}>
      <BaseProviders>{children}</BaseProviders>
    </PostHogProvider>
  );
}

export const Route = createRootRoute({
  head: () => {
    const { meta: seoMeta, links: seoLinks } = seo({
      title: `${appConfig.name}: Typed Notifications for Node.js`,
      description:
        'Type-safe email, SMS, and push notification infrastructure for Node.js. Define once, send everywhere with full TypeScript support.',
      keywords:
        'notifications, email, node.js, typescript, type-safe, email infrastructure, transactional email, zapier, cloudflare, better-notify, cloudflare emails, telegram, twilio, push notifications',
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
        <AnalyticsProvider>
          <Outlet />
        </AnalyticsProvider>
        <Scripts />
      </body>
    </html>
  );
}
