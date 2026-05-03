import { createFileRoute } from '@tanstack/react-router';
// @ts-expect-error Orama checks `self` for web worker detection; polyfill for Node SSR
globalThis.self ??= globalThis as typeof self;
import { createFromSource } from 'fumadocs-core/search/server';

import { source } from '@/lib/source';

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
