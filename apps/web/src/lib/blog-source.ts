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

export function mapPageToPost(page: (typeof blogSource)['$inferPage']): BlogPost {
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
}

export function getLatestBlogPosts(limit = 3): BlogPost[] {
  return blogSource
    .getPages()
    .map(mapPageToPost)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export function getAllBlogPosts() {
  const posts = blogSource
    .getPages()
    .map(mapPageToPost)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))] as string[];
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();

  return { posts, categories, allTags };
}
