import { createFileRoute } from '@tanstack/react-router';
import { generateOGImage } from 'fumadocs-ui/og/takumi';

import { source } from '@/lib/source';
import { appConfig } from '@/lib/shared';

export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET({ params }) {
        const raw = params._splat?.replace(/\/image\.png$/, '') ?? '';
        const prefix = 'docs/';
        if (!raw.startsWith(prefix)) {
          return new Response('Not found', { status: 404 });
        }

        const slugs = raw.slice(prefix.length).split('/');
        const page = source.getPage(slugs);

        if (!page) {
          return new Response('Not found', { status: 404 });
        }

        return generateOGImage({
          title: page.data.title,
          description: page.data.description as string | undefined,
          site: appConfig.name,
          primaryColor: appConfig.themeColor,
        });
      },
    },
  },
});
