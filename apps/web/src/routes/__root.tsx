import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

import appCss from '@/styles/app.css?url';
import { appConfig } from '@/lib/shared';
import { seo } from '@/lib/seo';

export const Route = createRootRoute({
  head: () => {
    const { meta: seoMeta, links: seoLinks } = seo({
      title: appConfig.name,
      description: 'End-to-end typed notifications for Node.js',
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
        <RootProvider>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
