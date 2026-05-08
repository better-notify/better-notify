export type Persona = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  whyFits: string[];
  codeExample: string;
  related: string[];
};

export const personas: Persona[] = [
  {
    slug: 'nextjs',
    name: 'Next.js',
    tagline: 'Type-safe notifications for Next.js apps',
    description:
      'Better-Notify integrates with Next.js API routes, server actions, and middleware. Define your notification catalog once and send from any server-side context — route handlers, server components, or background jobs.',
    whyFits: [
      'Works in API routes, server actions, and middleware',
      'ESM-native — no CJS compatibility issues',
      'Pairs with React Email for JSX templates',
      'Deploy to Vercel, Cloudflare, or self-hosted',
    ],
    codeExample: `// app/api/invite/route.ts
import { mail } from '@/lib/notifications';

export async function POST(req: Request) {
  const { email, teamName } = await req.json();

  const result = await mail.teamInvite.send({
    to: email,
    input: { teamName },
  });

  return Response.json({ messageId: result.messageId });
}`,
    related: ['remix', 'express', 'cloudflare-workers'],
  },
  {
    slug: 'express',
    name: 'Express',
    tagline: 'Type-safe notifications for Express.js APIs',
    description:
      'Add typed notifications to your Express API with zero config. Better-Notify runs as plain Node.js — import the client in any route handler and send.',
    whyFits: [
      'No framework middleware needed — just import and send',
      'Works with Express 4 and 5',
      'Use in route handlers, middleware, or background workers',
      'Pairs with any template engine',
    ],
    codeExample: `// routes/auth.ts
import { mail } from '../lib/notifications';

router.post('/signup', async (req, res) => {
  const user = await createUser(req.body);

  await mail.welcome.send({
    to: user.email,
    input: { name: user.name },
  });

  res.json({ ok: true });
});`,
    related: ['fastify', 'hono', 'nestjs'],
  },
  {
    slug: 'hono',
    name: 'Hono',
    tagline: 'Type-safe notifications for Hono apps',
    description:
      'Better-Notify works anywhere Hono does — Cloudflare Workers, Deno, Bun, or Node.js. Both libraries are ESM-first, TypeScript-native, and designed for edge runtimes.',
    whyFits: [
      'ESM-only — matches Hono\'s module system',
      'Runs on Cloudflare Workers, Deno, Bun, Node.js',
      'Lightweight — no heavy dependencies for edge',
      'Cloudflare Email transport for edge-native delivery',
    ],
    codeExample: `// src/index.ts
import { Hono } from 'hono';
import { mail } from './lib/notifications';

const app = new Hono();

app.post('/contact', async (c) => {
  const { email, message } = await c.req.json();

  await mail.contactForm.send({
    to: 'support@example.com',
    input: { from: email, message },
  });

  return c.json({ sent: true });
});

export default app;`,
    related: ['cloudflare-workers', 'express', 'fastify'],
  },
  {
    slug: 'cloudflare-workers',
    name: 'Cloudflare Workers',
    tagline: 'Type-safe notifications at the edge with Cloudflare Workers',
    description:
      'Send notifications from Cloudflare Workers using Cloudflare Email Routing or any HTTP-based transport. Better-Notify is ESM-only and works natively in the Workers runtime.',
    whyFits: [
      'ESM-only — works in Workers without bundler hacks',
      'Native Cloudflare Email transport',
      'No SMTP or TCP sockets required',
      'Works with Queues for async delivery',
    ],
    codeExample: `// src/worker.ts
import { mail } from './lib/notifications';

export default {
  async fetch(req: Request): Promise<Response> {
    const { to, orderId } = await req.json();

    await mail.orderConfirmation.send({
      to,
      input: { orderId },
    });

    return new Response('sent');
  },
};`,
    related: ['hono', 'nextjs', 'remix'],
  },
  {
    slug: 'fastify',
    name: 'Fastify',
    tagline: 'Type-safe notifications for Fastify APIs',
    description:
      'Add typed notifications to Fastify with zero plugins. Better-Notify runs as a plain import — use it in route handlers, hooks, or background tasks.',
    whyFits: [
      'No Fastify plugin needed — just import',
      'Matches Fastify\'s schema-first approach',
      'Works with Fastify\'s TypeBox/Zod validation',
      'Use in route handlers or lifecycle hooks',
    ],
    codeExample: `// routes/orders.ts
import { mail } from '../lib/notifications';

fastify.post('/orders', async (req, reply) => {
  const order = await createOrder(req.body);

  await mail.orderConfirmation.send({
    to: order.customerEmail,
    input: { orderId: order.id, total: order.total },
  });

  return { orderId: order.id };
});`,
    related: ['express', 'hono', 'nestjs'],
  },
  {
    slug: 'nestjs',
    name: 'NestJS',
    tagline: 'Type-safe notifications for NestJS applications',
    description:
      'Use Better-Notify as a NestJS service. Inject the typed client into controllers, services, or guards — notification routes stay type-safe across your entire dependency tree.',
    whyFits: [
      'Works as an injectable service',
      'Type-safe across the DI container',
      'Use with NestJS guards and interceptors',
      'Pairs with NestJS Bull queues for async delivery',
    ],
    codeExample: `// notifications.service.ts
import { Injectable } from '@nestjs/common';
import { mail } from './notifications.client';

@Injectable()
export class NotificationsService {
  async sendWelcome(email: string, name: string) {
    return mail.welcome.send({
      to: email,
      input: { name },
    });
  }
}`,
    related: ['express', 'fastify'],
  },
  {
    slug: 'trpc',
    name: 'tRPC',
    tagline: 'Type-safe notifications for tRPC APIs',
    description:
      'Better-Notify follows the same philosophy as tRPC — define a typed contract, consume it everywhere. Use the notification client in any tRPC procedure with full end-to-end type safety.',
    whyFits: [
      'Same mental model — typed contracts drive the API',
      'Use in any tRPC procedure or middleware',
      'Shares Zod schemas between tRPC and Better-Notify',
      'End-to-end type safety from router to transport',
    ],
    codeExample: `// server/routers/auth.ts
import { mail } from '../notifications';

export const authRouter = router({
  signup: publicProcedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input }) => {
      const user = await createUser(input);

      await mail.welcome.send({
        to: user.email,
        input: { name: user.name },
      });

      return { userId: user.id };
    }),
});`,
    related: ['nextjs', 'express', 'fastify'],
  },
  {
    slug: 'remix',
    name: 'Remix',
    tagline: 'Type-safe notifications for Remix apps',
    description:
      'Send notifications from Remix loaders and actions. Better-Notify works in any server-side context — action handlers, resource routes, or background jobs triggered from your Remix app.',
    whyFits: [
      'Works in loaders, actions, and resource routes',
      'ESM-native — no import issues',
      'Deploy to any Remix-supported platform',
      'Use React Email for JSX templates',
    ],
    codeExample: `// app/routes/contact.tsx
import { mail } from '~/lib/notifications';
import type { ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();

  await mail.contactForm.send({
    to: 'support@example.com',
    input: {
      name: String(form.get('name')),
      message: String(form.get('message')),
    },
  });

  return { sent: true };
}`,
    related: ['nextjs', 'express', 'cloudflare-workers'],
  },
];

export const getPersona = (slug: string): Persona | undefined =>
  personas.find((p) => p.slug === slug);

export const getRelatedPersonas = (slugs: string[]): Persona[] =>
  slugs.map((s) => personas.find((p) => p.slug === s)).filter(Boolean) as Persona[];
