import { createFileRoute } from '@tanstack/react-router';

import { appConfig } from '@/lib/shared';
import { source } from '@/lib/source';
import { integrations } from '@/lib/integrations';
import { personas } from '@/lib/personas';
import { blogSource } from '@/lib/blog-source';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET() {
        const pages = source.getPages();
        const blogPages = blogSource.getPages();

        const urls = [
          { loc: `${appConfig.baseUrl}/` },
          { loc: `${appConfig.baseUrl}/mcp` },
          { loc: `${appConfig.baseUrl}/blog` },
          ...pages.map((page) => ({
            loc: `${appConfig.baseUrl}${page.url}`,
          })),
          ...blogPages.map((page) => ({
            loc: `${appConfig.baseUrl}${page.url}`,
          })),
          { loc: `${appConfig.baseUrl}/integrations` },
          ...integrations.map((i) => ({
            loc: `${appConfig.baseUrl}/integrations/${i.slug}`,
          })),
          { loc: `${appConfig.baseUrl}/for` },
          ...personas.map((p) => ({
            loc: `${appConfig.baseUrl}/for/${p.slug}`,
          })),
        ];

        const escapeXml = (str: string) =>
          str.replace(/[&<>"']/g, (ch) =>
            ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&apos;',
          );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls.map(
            (entry) =>
              `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n  </url>`,
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
