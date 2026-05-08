import { createFileRoute } from '@tanstack/react-router';

globalThis.self ??= globalThis as typeof self;

const { createFromSource } = await import('fumadocs-core/search/server');
const { source } = await import('@/lib/source');

const server = createFromSource(source, {
  language: 'english',
});

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
});
