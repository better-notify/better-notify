import {
  NotifyRpcRateLimitedError,
  createNotify,
  createClient,
  inMemoryRateLimitStore,
  withRateLimit,
} from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { z } from 'zod';
import { mockTransport } from '../test-utils';

export const runRateLimited = async (): Promise<void> => {
  const ch = emailChannel({ defaults: { from: 'demo@example.com' } });
  const rpc = createNotify({ channels: { email: ch } }).use(
    withRateLimit({
      store: inMemoryRateLimitStore(),
      key: ({ args }) => (Array.isArray(args.to) ? 'multi' : String(args.to)),
      max: 2,
      window: 60_000,
    }),
  );

  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject(({ input }) => `Hello ${input.name}`)
      .template({ render: async ({ input }) => ({ html: `<p>${input.name}</p>` }) }),
  });

  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: mockTransport('mock') },
  });

  const send = async (i: number): Promise<void> => {
    try {
      const result = await mail.welcome.send({
        to: 'john@example.com',
        input: { name: `John Doe ${i}` },
      });
      console.log(`#${i} ok          messageId=${result.messageId.slice(0, 8)}`);
    } catch (err) {
      if (err instanceof NotifyRpcRateLimitedError) {
        console.log(
          `#${i} rate-limited  key=${err.key} retryAfterMs=${err.retryAfterMs.toFixed(0)}`,
        );
        return;
      }
      throw err;
    }
  };

  for (let i = 1; i <= 4; i++) await send(i);
  console.log('— max=2 per 60s; the 3rd and 4th sends to the same recipient throw.');
};
