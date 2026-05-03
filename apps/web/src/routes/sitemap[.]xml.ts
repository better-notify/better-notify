import { createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/lib/shared';
import { source } from '@/lib/source';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET() {
        const today = new Date().toISOString().split('T')[0];
        const pages = source.getPages();

        const urls = [
          { loc: appConfig.baseUrl, changefreq: 'weekly', priority: '1.0' },
          ...pages.map((page) => ({
            loc: `${appConfig.baseUrl}${page.url}`,
            changefreq: 'weekly',
            priority: '0.7',
          })),
        ];

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map(
            (entry) =>
              `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
          ),
          '</urlset>',
        ].join('\n');

        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        });
      },
    },
  },
});
