import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createNotify, createClient, consoleLogger, handlePromise } from '@betternotify/core';
import { webPushChannel, generateVapidKeys } from '@betternotify/webpush';
import type { WebPushSubscription } from '@betternotify/webpush';
import { vapidTransport } from '@betternotify/webpush/transports';
import { z } from 'zod';

const subscriptions: WebPushSubscription[] = [];

type SSEClient = {
  send: (data: string) => void;
  close: () => void;
};

const sseClients = new Set<SSEClient>();

const broadcast = (event: string, data: unknown) => {
  const payload = JSON.stringify(data);

  for (const client of sseClients) {
    client.send(`event: ${event}\ndata: ${payload}\n\n`);
  }
};

const start = async () => {
  const keys = await generateVapidKeys();
  console.log('VAPID keys generated (subscriptions reset on restart)');

  const rpc = createNotify({ channels: { webpush: webPushChannel() } });

  const catalog = rpc.catalog({
    alert: rpc
      .webpush()
      .input(z.object({ title: z.string(), body: z.string() }))
      .title(({ input }) => input.title)
      .body(({ input }) => input.body),
  });

  const client = createClient({
    catalog,
    transportsByChannel: {
      webpush: vapidTransport({
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        subject: 'mailto:demo@example.com',
      }),
    },
    logger: consoleLogger({ level: 'debug' }),
  });

  const app = new Hono();

  app.get('/api/vapid-public-key', (c) => c.json({ publicKey: keys.publicKey }));

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const sseClient: SSEClient = {
        send: (data: string) => {
          stream.write(data);
        },
        close: () => {
          sseClients.delete(sseClient);
        },
      };
      sseClients.add(sseClient);

      stream.onAbort(() => {
        sseClients.delete(sseClient);
      });

      await stream.writeSSE({ data: '', event: 'connected' });

      await new Promise(() => {});
    }),
  );

  app.post('/api/subscribe', async (c) => {
    const sub = await c.req.json<WebPushSubscription>();
    const exists = subscriptions.some((s) => s.endpoint === sub.endpoint);
    if (!exists) subscriptions.push(sub);
    console.log(`Subscription ${exists ? 'restored' : 'stored'} (${subscriptions.length} total)`);

    if (!exists) {
      const [err] = await handlePromise(
        client.alert.send({
          to: sub,
          input: {
            title: "You're subscribed!",
            body: 'Web push is working via @betternotify/webpush.',
          },
        }),
      );

      if (err) {
        console.error('Welcome notification failed:', err.message);
      }

      broadcast('notification', {
        title: "You're subscribed!",
        body: 'Web push is working via @betternotify/webpush.',
      });
    }

    return c.json({ ok: true });
  });

  app.post('/api/send', async (c) => {
    const { title, body } = await c.req.json<{ title: string; body: string }>();

    if (subscriptions.length === 0) {
      return c.json({ ok: false, error: 'No subscriptions' }, 400);
    }

    const [err, result] = await handlePromise(
      client.alert.send({
        to: subscriptions,
        input: { title, body },
      }),
    );

    if (err) {
      return c.json({ ok: false, error: err.message }, 500);
    }

    broadcast('notification', { title, body, messageId: result.messageId });

    return c.json({ ok: true, messageId: result.messageId });
  });

  app.use('/*', serveStatic({ root: './src/public' }));

  serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  });
};

start();
