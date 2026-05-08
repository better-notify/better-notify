import { defineConfig, defineDocs, defineCollections } from 'fumadocs-mdx/config';
import { pageSchema } from 'fumadocs-core/source/schema';
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
  schema: pageSchema.extend({
    date: z.iso.date().or(z.date()),
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
