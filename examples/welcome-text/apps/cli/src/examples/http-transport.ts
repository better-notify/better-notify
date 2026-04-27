import { createClient, createEmailRpc, EmailRpcError } from '@emailrpc/core';
import { createTransport, formatAddress, normalizeAddress } from '@emailrpc/core/transports';
import { z } from 'zod';
import { env } from '../env';

type HttpTransportOptions = {
  name?: string;
  url: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

const httpTransport = (opts: HttpTransportOptions) => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return createTransport({
    name: opts.name ?? 'http',
    send: async (message, ctx) => {
      const body = {
        from: formatAddress(message.from),
        to: message.to.map(formatAddress),
        cc: message.cc?.map(formatAddress),
        bcc: message.bcc?.map(formatAddress),
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      };

      const response = await fetchImpl(opts.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
          'X-EmailRpc-Route': ctx.route,
          'X-EmailRpc-Message-Id': ctx.messageId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new EmailRpcError({
          message:
            `HTTP transport failed: ${response.status} ${response.statusText} ${detail}`.trim(),
          code: 'PROVIDER',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
      };

      return {
        transportMessageId: payload.id ?? response.headers.get('x-request-id') ?? undefined,
        accepted: message.to.map(normalizeAddress),
        rejected: [],
        raw: payload,
      };
    },
    verify: async () => {
      const response = await fetchImpl(opts.url, { method: 'OPTIONS' }).catch(() => undefined);
      return { ok: response?.ok ?? false, details: { status: response?.status } };
    },
  });
};

const rpc = createEmailRpc();
const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), verifyUrl: z.string().url() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template({
      render: async ({ input }) => ({
        text: `Welcome, ${input.name}! Verify here: ${input.verifyUrl}`,
        html: `<p>Welcome, <strong>${input.name}</strong>! <a href="${input.verifyUrl}">Verify</a></p>`,
      }),
    }),
});

export const runHttpTransport = async (): Promise<void> => {
  const targetUrl = process.env.HTTP_TRANSPORT_URL ?? 'https://httpbin.org/post';

  const mail = createClient({
    catalog,
    transports: [
      {
        name: 'http',
        priority: 1,
        transport: httpTransport({
          url: targetUrl,
          apiKey: process.env.HTTP_TRANSPORT_API_KEY,
        }),
      },
    ],
    defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
  });

  console.log(`POSTing rendered email to ${targetUrl}`);

  const result = await mail.welcome.send({
    to: 'demo@example.com',
    input: { name: 'Demo User', verifyUrl: 'https://example.com/verify?token=abc' },
  });

  console.log('---');
  console.log('Message ID:    ', result.messageId);
  console.log('Provider ID:   ', result.providerMessageId ?? '(none)');
  console.log('Accepted:      ', result.accepted.join(', '));
  console.log('Render time:   ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('HTTP send time:', `${result.timing.sendMs.toFixed(1)}ms`);
};
