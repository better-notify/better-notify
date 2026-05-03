import { createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET() {
        const body = [
          'User-agent: *',
          'Allow: /',
          '',
          `Sitemap: ${appConfig.baseUrl}/sitemap.xml`,
        ].join('\n');

        return new Response(body, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      },
    },
  },
});
