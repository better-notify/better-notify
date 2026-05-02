import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { remarkNpm } from 'fumadocs-core/mdx-plugins';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkNpm, { persist: { id: 'package-manager' } }]],
  },
});
