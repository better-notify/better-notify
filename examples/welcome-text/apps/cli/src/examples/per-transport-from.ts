import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel, createTransport, multiTransport } from '@betternotify/email';
import { z } from 'zod';

/**
 * Sender identity is provider-bound: the transport closure stamps it.
 * No framework `defaultFrom` — provider authors close over their sender info
 * inside `send`, the framework stays out of it.
 *
 * For multi-tenant (one transport, dynamic sender) use a `from` resolver that
 * reads ctx — middleware sets ctx based on tenant context (e.g. AsyncLocalStorage).
 */

const ch = emailChannel();
const rpc = createNotify({ channels: { email: ch } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({ render: async ({ input }) => ({ html: `<p>Hi ${input.name}</p>` }) }),
});

// Two providers, each closes over its own verified sender.
const accountX = createTransport({
  name: 'sendgrid-x',
  send: async (msg) => {
    const from = msg.from ?? 'noreply@x.com';
    console.log(`[X] would send from=${JSON.stringify(from)} to=${JSON.stringify(msg.to)}`);
    return { ok: true, data: { accepted: msg.to.map(String), rejected: [] } };
  },
});

const accountY = createTransport({
  name: 'sendgrid-y',
  send: async (msg) => {
    const from = msg.from ?? { name: 'Acme Y', email: 'noreply@y.com' };
    console.log(`[Y] would send from=${JSON.stringify(from)} to=${JSON.stringify(msg.to)}`);
    return { ok: true, data: { accepted: msg.to.map(String), rejected: [] } };
  },
});

export const runPerTransportFrom = async (): Promise<void> => {
  const composite = multiTransport({
    name: 'two-accounts',
    strategy: 'round-robin',
    transports: [{ transport: accountX }, { transport: accountY }],
    logger: consoleLogger({ level: 'info' }),
  });

  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: composite },
  });

  console.log('Two providers, each stamps its own verified `from` inside its send closure.');
  console.log('---');
  for (let i = 1; i <= 4; i++) {
    await mail.welcome.send({
      to: `user${i}@example.com`,
      input: { name: `User ${i}` },
    });
  }
  console.log('---');
  console.log('Sender lives in the transport closure. The framework never sees it.');
};
