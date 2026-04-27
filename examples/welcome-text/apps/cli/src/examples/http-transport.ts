import { createNotify, createClient, NotifyRpcError } from '@emailrpc/core';
import { emailChannel } from '@emailrpc/email';
import { createTransport, formatAddress, normalizeAddress } from '@emailrpc/email/transports';
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
          'X-NotifyRpc-Route': ctx.route,
          'X-NotifyRpc-Message-Id': ctx.messageId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new NotifyRpcError({
          message:
            `HTTP transport failed: ${response.status} ${response.statusText} ${detail}`.trim(),
          code: 'PROVIDER',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }

      const payload = (await response.json().catch(() => ({}))) as { id?: string };

      return {
        ok: true,
        data: {
          transportMessageId: payload.id ?? response.headers.get('x-request-id') ?? undefined,
          accepted: message.to.map(normalizeAddress),
          rejected: [],
          raw: payload,
        },
      };
    },
    verify: async () => {
      const response = await fetchImpl(opts.url, { method: 'OPTIONS' }).catch(() => undefined);
      return { ok: response?.ok ?? false, details: { status: response?.status } };
    },
  });
};

const ch = emailChannel({
  defaults: { from: { name: env.SMTP_FROM_NAME, email: env.SMTP_USER } },
});
const rpc = createNotify({ channels: { email: ch } });
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
    channels: { email: ch },
    transportsByChannel: {
      email: httpTransport({
        url: targetUrl,
        apiKey: process.env.HTTP_TRANSPORT_API_KEY,
      }),
    },
  });

  console.log(`POSTing rendered email to ${targetUrl}`);

  const result = await mail.welcome.send({
    to: 'demo@example.com',
    input: { name: 'Demo User', verifyUrl: 'https://example.com/verify?token=abc' },
  });

  const data = result.data as { accepted: string[]; transportMessageId?: string };
  console.log('---');
  console.log('Message ID:    ', result.messageId);
  console.log('Provider ID:   ', data.transportMessageId ?? '(none)');
  console.log('Accepted:      ', data.accepted.join(', '));
  console.log('Render time:   ', `${result.timing.renderMs.toFixed(1)}ms`);
  console.log('HTTP send time:', `${result.timing.sendMs.toFixed(1)}ms`);
};
