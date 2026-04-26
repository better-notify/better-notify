import {
  EmailRpcRateLimitedError,
  createClient,
  createEmailRpc,
  inMemoryRateLimitStore,
  withRateLimit,
} from '@emailrpc/core';
import { z } from 'zod';
import { mockTransport } from '../test-utils';

export const runRateLimited = async (): Promise<void> => {
  const rpc = createEmailRpc().use(
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
    transports: [{ name: 'mock', priority: 1, transport: mockTransport('mock') }],
    defaults: { from: 'demo@example.com' },
  });

  const send = async (i: number): Promise<void> => {
    try {
      const result = await mail.welcome.send({
        to: 'lucas@example.com',
        input: { name: `Lucas ${i}` },
      });
      console.log(`#${i} ok          messageId=${result.messageId.slice(0, 8)}`);
    } catch (err) {
      if (err instanceof EmailRpcRateLimitedError) {
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
