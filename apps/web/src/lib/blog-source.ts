import { blogPosts } from 'collections/server';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';
import { loader } from 'fumadocs-core/source';

export const blogSource = loader({
  baseUrl: '/blog',
  source: toFumadocsSource(blogPosts, []),
});

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  category: string | null;
};

const toEpoch = (date: string): number => {
  const epoch = Date.parse(date);
  return Number.isNaN(epoch) ? Number.NEGATIVE_INFINITY : epoch;
};

const assertUniqueSlugs = (posts: BlogPost[]): void => {
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`Duplicate blog slug detected: "${post.slug}"`);
    }
    seen.add(post.slug);
  }
};

export const mapPageToPost = (page: (typeof blogSource)['$inferPage']): BlogPost => {
  const data = page.data as unknown as Record<string, unknown>;
  return {
    slug: page.slugs.at(-1) ?? '',
    title: page.data.title,
    description: (page.data.description as string) ?? '',
    date: typeof data.date === 'string' ? data.date : data.date instanceof Date ? data.date.toISOString().split('T')[0] : '',
    author: (data.author as string) ?? 'Lucas Reis',
    tags: (data.tags as string[]) ?? [],
    category: page.slugs.length > 1 ? (page.slugs[0] ?? null) : null,
  };
};

export const getLatestBlogPosts = (limit = 3): BlogPost[] => {
  const posts = blogSource
    .getPages()
    .map(mapPageToPost)
    .sort((a, b) => toEpoch(b.date) - toEpoch(a.date));
  assertUniqueSlugs(posts);
  return posts.slice(0, limit);
};

export const getAllBlogPosts = () => {
  const posts = blogSource
    .getPages()
    .map(mapPageToPost)
    .sort((a, b) => toEpoch(b.date) - toEpoch(a.date));
  assertUniqueSlugs(posts);

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[];
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();

  return { posts, categories, allTags };
};
