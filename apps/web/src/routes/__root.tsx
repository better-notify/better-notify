import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

import appCss from '@/styles/app.css?url';
import { appConfig } from '@/lib/shared';
import { seo } from '@/lib/seo';

export const Route = createRootRoute({
  head: () => {
    const { meta: seoMeta, links: seoLinks } = seo({
      title: `${appConfig.name} — End-to-end Typed Notifications for Node.js`,
      description:
        'Type-safe email, SMS, and push notification infrastructure for Node.js. Define once, send everywhere with full TypeScript support.',
      keywords:
        'notifications, email, node.js, typescript, type-safe, email infrastructure, transactional email',
      image: `${appConfig.baseUrl}/og-image.png`,
      url: appConfig.baseUrl,
      canonicalUrl: appConfig.baseUrl,
    });

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'application-name', content: appConfig.name },
        ...seoMeta,
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        ...seoLinks,
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
        <RootProvider theme={{ disableTransitionOnChange: false }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
