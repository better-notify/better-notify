import { defineConfig, defineDocs, defineCollections, frontmatterSchema } from 'fumadocs-mdx/config';
import { remarkNpm } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const blogPosts = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    date: z.string().date().or(z.date()),
    tags: z.array(z.string()).optional().default([]),
    author: z.string().optional().default('Lucas Reis'),
    image: z.string().optional(),
  }),
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkNpm, { persist: { id: 'package-manager' } }]],
  },
});
