import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { RPCHandler } from '@orpc/server/fetch';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { SmartCoercionPlugin } from '@orpc/json-schema';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { router } from './rpc';

const app = new Hono();

app.get('/', (c) => c.json({ status: 'ok', message: 'better-notify + hono + orpc' }));

const rpcHandler = new RPCHandler(router);

app.use('/rpc/*', async (c, next) => {
  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

const openAPIHandler = new OpenAPIHandler(router, {
  plugins: [
    new SmartCoercionPlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
    new OpenAPIReferencePlugin({
      clientPath: '/docs',
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: '{{name}} API',
          version: '0.0.1',
        },
      },
    }),
  ],
});

app.use('/api/*', async (c, next) => {
  const { matched, response } = await openAPIHandler.handle(c.req.raw, {
    prefix: '/api',
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

const port = Number(process.env.PORT ?? 3000);

console.log(`Server running at http://localhost:${port}`);
console.log(`API Playground at http://localhost:${port}/api/docs`);
serve({ fetch: app.fetch, port });
