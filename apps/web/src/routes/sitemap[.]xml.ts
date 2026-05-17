import { createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/lib/shared';
import { source } from '@/lib/source';
import { integrations } from '@/lib/integrations';
import { personas } from '@/lib/personas';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET() {
        const today = new Date().toISOString().split('T')[0];
        const pages = source.getPages();

        const urls = [
          { loc: `${appConfig.baseUrl}/`, changefreq: 'daily', priority: '1.0' },
          { loc: `${appConfig.baseUrl}/mcp`, changefreq: 'weekly', priority: '0.9' },
          ...pages.map((page) => ({
            loc: `${appConfig.baseUrl}${page.url}`,
            changefreq: 'weekly',
            priority: '0.7',
          })),
          { loc: `${appConfig.baseUrl}/integrations`, changefreq: 'weekly', priority: '0.8' },
          ...integrations.map((i) => ({
            loc: `${appConfig.baseUrl}/integrations/${i.slug}`,
            changefreq: 'monthly',
            priority: '0.6',
          })),
          { loc: `${appConfig.baseUrl}/for`, changefreq: 'weekly', priority: '0.8' },
          ...personas.map((p) => ({
            loc: `${appConfig.baseUrl}/for/${p.slug}`,
            changefreq: 'monthly',
            priority: '0.6',
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
