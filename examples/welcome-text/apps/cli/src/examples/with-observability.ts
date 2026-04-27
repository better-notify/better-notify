import {
  consoleEventSink,
  createNotify,
  createClient,
  inMemoryEventSink,
  inMemoryTracer,
  withEventLogger,
  withTracing,
} from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { z } from 'zod';
import { mockTransport } from '../test-utils';

export const runObservability = async (): Promise<void> => {
  const sink = inMemoryEventSink();
  const tracer = inMemoryTracer();

  const ch = emailChannel({ defaults: { from: 'demo@example.com' } });
  const rpc = createNotify({ channels: { email: ch } })
    .use(withTracing({ tracer }))
    .use(withEventLogger({ sink }))
    .use(withEventLogger({ sink: consoleEventSink() }));

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

  await mail.welcome.send({ to: 'john@example.com', input: { name: 'John Doe' } });
  await mail.welcome.send({ to: 'sarah@example.com', input: { name: 'Sarah' } });

  console.log('---');
  console.log(`captured events: ${sink.events.length}`);
  for (const ev of sink.events) {
    console.log(
      `  ${ev.status.padEnd(7)} route=${ev.route} messageId=${ev.messageId.slice(0, 8)} duration=${ev.durationMs.toFixed(1)}ms`,
    );
  }

  console.log(`recorded spans:  ${tracer.spans.length}`);
  for (const span of tracer.spans) {
    console.log(
      `  ${span.name.padEnd(28)} status=${span.status?.code} attrs=${JSON.stringify(span.attributes)}`,
    );
  }
};
