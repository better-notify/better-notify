import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { RPCHandler } from '@orpc/server/fetch';
import { router } from './rpc';

const app = new Hono();

app.get('/', (c) => c.json({ status: 'ok', message: 'better-notify + hono + orpc' }));

const handler = new RPCHandler(router);

app.use('/rpc/*', async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/rpc',
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

const port = Number(process.env.PORT ?? 3000);

console.log(`Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
