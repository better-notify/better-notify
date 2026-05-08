import { createFileRoute } from '@tanstack/react-router';
import { handlePromise } from '@betternotify/core';

const POSTHOG_HOST = 'https://eu.posthog.com';

const proxy = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/ingest/, '');
  const target = `${POSTHOG_HOST}${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set('host', new URL(POSTHOG_HOST).host);
  headers.delete('cookie');

  const result = await handlePromise(
    fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : request.body,
    }),
  );

  if (!result[0]) {
    return new Response('Analytics endpoint unavailable', { status: 503 });
  }

  const res = result[0];
  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete('set-cookie');

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
};

export const Route = createFileRoute('/ingest/$')({
  server: {
    handlers: {
      GET: ({ request }) => proxy(request),
      POST: ({ request }) => proxy(request),
    },
  },
});
