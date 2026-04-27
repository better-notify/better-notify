import {
  EmailRpcRateLimitedError,
  consoleLogger,
  createClient,
  createNotify,
  inMemoryEventSink,
  inMemoryIdempotencyStore,
  inMemoryRateLimitStore,
  inMemorySuppressionList,
  inMemoryTracer,
  withEventLogger,
  withIdempotency,
  withRateLimit,
  withSuppressionList,
  withTracing,
} from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { z } from 'zod';
import { env } from '../env';
import { mockTransport } from '../test-utils';

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});

const welcomeInput = z.object({ name: z.string(), verifyUrl: z.string().url() });
const resetInput = z.object({ name: z.string(), resetUrl: z.string().url() });
const newsletterInput = z.object({ headline: z.string(), bodyUrl: z.string().url() });

const stores = {
  suppression: inMemorySuppressionList({
    seed: {
      'blocked@example.com': { reason: 'unsubscribe', createdAt: new Date('2026-01-01') },
    },
  }),
  rateLimit: inMemoryRateLimitStore(),
  idempotency: inMemoryIdempotencyStore(),
};

const observability = {
  sink: inMemoryEventSink(),
  tracer: inMemoryTracer(),
};

const rpc = createNotify({ channels: { email: ch } })
  .use(withTracing({ tracer: observability.tracer }))
  .use(withEventLogger({ sink: observability.sink }))
  .use(withSuppressionList({ list: stores.suppression }))
  .use(
    withRateLimit({
      store: stores.rateLimit,
      key: ({ args }) => (Array.isArray(args.to) ? 'multi' : String(args.to)),
      max: 5,
      window: 60_000,
    }),
  );

const transactional = rpc.catalog({
  welcome: rpc
    .email()
    .input(welcomeInput)
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .use(
      withIdempotency<z.infer<typeof welcomeInput>>({
        store: stores.idempotency,
        key: ({ input, args }) => `welcome:${args.to}:${input.name}`,
        ttl: 24 * 60 * 60_000,
      }),
    )
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}! Verify: ${input.verifyUrl}`,
        html: `<p>Welcome, ${input.name}! <a href="${input.verifyUrl}">Verify</a></p>`,
      }),
    }),
  reset: rpc
    .email()
    .input(resetInput)
    .subject(() => 'Reset your password')
    .template({
      render: async ({ input }) => ({
        text: `Hi ${input.name}, reset here: ${input.resetUrl}`,
        html: `<p>Hi ${input.name}, <a href="${input.resetUrl}">reset your password</a>.</p>`,
      }),
    }),
});

const marketing = rpc.catalog({
  newsletter: rpc
    .email()
    .input(newsletterInput)
    .subject(({ input }) => input.headline)
    .template({
      render: async ({ input }) => ({
        text: `${input.headline} — read: ${input.bodyUrl}`,
        html: `<h1>${input.headline}</h1><p><a href="${input.bodyUrl}">Read more</a></p>`,
      }),
    }),
});

const catalog = rpc.catalog({ transactional, marketing });

export const runKitchenSink = async (): Promise<void> => {
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
    logger: consoleLogger({ level: 'warn' }),
  });

  const sendWelcome = async (
    label: string,
    to: string,
    input: { name: string; verifyUrl: string },
  ): Promise<void> => {
    try {
      const result = await mail.transactional.welcome.send({ to, input });
      console.log(`${label.padEnd(28)} → ${result.messageId.slice(0, 12)}`);
    } catch (err) {
      if (err instanceof EmailRpcRateLimitedError) {
        console.log(
          `${label.padEnd(28)} → rate-limited (retry in ${err.retryAfterMs.toFixed(0)}ms)`,
        );
        return;
      }
      throw err;
    }
  };

  const verifyUrl = 'https://example.com/verify?token=demo';

  console.log('1. fresh send via transactional sub-catalog (idempotency miss, rate limit ok)');
  await sendWelcome('  first send', 'john@example.com', { name: 'John Doe', verifyUrl });

  console.log('2. same key (idempotency hit — replays cached result)');
  await sendWelcome('  second send same key', 'john@example.com', { name: 'John Doe', verifyUrl });

  console.log('3. blocked recipient (suppression short-circuit)');
  await sendWelcome('  to suppressed', 'blocked@example.com', { name: 'Blocked', verifyUrl });

  console.log('4. burn the rate limit (max=5 per 60s, keyed per-recipient)');
  for (let i = 0; i < 6; i++) {
    await sendWelcome(`  send #${i + 1} to sarah`, 'sarah@example.com', {
      name: `Sarah ${i}`,
      verifyUrl,
    });
  }

  console.log('5. send via marketing sub-catalog (nested path: mail.marketing.newsletter)');
  const newsletter = await mail.marketing.newsletter.send({
    to: 'john@example.com',
    input: {
      headline: 'Weekly update',
      bodyUrl: 'https://example.com/posts/weekly',
    },
  });
  console.log(`  newsletter → ${newsletter.messageId.slice(0, 12)}`);

  console.log('6. send via transactional.reset (second route in transactional sub-catalog)');
  const reset = await mail.transactional.reset.send({
    to: 'john@example.com',
    input: { name: 'John Doe', resetUrl: 'https://example.com/reset?token=demo' },
  });
  console.log(`  reset → ${reset.messageId.slice(0, 12)}`);

  console.log('---');
  console.log(`events written: ${observability.sink.events.length}`);
  console.log(`spans recorded: ${observability.tracer.spans.length}`);
};
