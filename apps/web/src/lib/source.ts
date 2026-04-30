import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { createElement } from 'react';

import { docsRoute } from './shared';
import { iconMap } from './icons';

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  icon(name) {
    if (!name || !(name in iconMap)) return;
    return createElement(iconMap[name as keyof typeof iconMap], { size: 18 });
  },
});

export const getPageMarkdownUrl = (page: (typeof source)['$inferPage']) => {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `/llms.mdx/docs/${segments.join('/')}`,
  };
};
