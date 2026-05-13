import { consoleLogger, handlePromise, NotifyRpcProviderError } from '@betternotify/core';
import { createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import { createVapidJwt, encryptPayload } from '../crypto.js';
import type { RenderedWebPush, WebPushSubscription } from '../types.js';
import type { WebPushSubscriptionResult, WebPushTransportData } from './types.js';
import { createTransport } from './multi.js';
import type { VapidTransportOptions } from './vapid.types.js';

const DEFAULT_TTL = 2419200;
const DEFAULT_TIMEOUT_MS = 30_000;

export const vapidTransport = (opts: VapidTransportOptions) => {
  const log = (opts.logger ?? consoleLogger()).child({ component: 'webpush-vapid' });
  const http = createHttpClient({
    ...opts.http,
    timeoutMs: opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const sendToSubscription = async (
    sub: WebPushSubscription,
    payload: string,
    ctx: { route: string; messageId: string },
  ): Promise<WebPushSubscriptionResult> => {
    const [jwtErr, vapid] = await handlePromise(
      createVapidJwt(sub.endpoint, opts.subject, opts.privateKey, opts.publicKey),
    );
    if (jwtErr) {
      log.error('VAPID JWT generation failed', { err: jwtErr, route: ctx.route });
      return { endpoint: sub.endpoint, ok: false };
    }

    const [encErr, encrypted] = await handlePromise(
      encryptPayload(payload, sub.keys.p256dh, sub.keys.auth),
    );
    if (encErr) {
      log.error('Payload encryption failed', { err: encErr, route: ctx.route });
      return { endpoint: sub.endpoint, ok: false };
    }

    const result = await http.request(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapid.authorization,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: String(opts.ttl ?? DEFAULT_TTL),
        Urgency: opts.urgency ?? 'normal',
      },
      body: encrypted.ciphertext,
    });

    if (!result.ok) {
      if (result.kind === 'network') {
        log.error('Web push delivery failed', { err: result.cause, route: ctx.route });
        return { endpoint: sub.endpoint, ok: false };
      }
      const gone = result.status === 404 || result.status === 410;
      if (gone) {
        log.warn('Subscription expired', {
          endpoint: sub.endpoint,
          status: result.status,
          route: ctx.route,
        });
      } else {
        log.error('Push service returned error', {
          status: result.status,
          route: ctx.route,
          endpoint: sub.endpoint,
        });
      }
      return { endpoint: sub.endpoint, ok: false, statusCode: result.status, gone };
    }

    return { endpoint: sub.endpoint, ok: true, statusCode: 201 };
  };

  return createTransport({
    name: 'webpush-vapid',
    async send(rendered: RenderedWebPush, ctx) {
      const subs = Array.isArray(rendered.to) ? rendered.to : rendered.to ? [rendered.to] : [];

      if (subs.length === 0) {
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: 'VAPID transport: no subscriptions provided',
            code: 'VALIDATION',
            provider: 'webpush-vapid',
            retriable: false,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const { to: _to, ...notificationPayload } = rendered;
      const payload = JSON.stringify(notificationPayload);

      const results = await Promise.all(subs.map((sub) => sendToSubscription(sub, payload, ctx)));

      const allFailed = results.every((r) => !r.ok);
      if (allFailed) {
        const { code, retriable } = mapHttpStatus(results[0]?.statusCode ?? 500);
        return {
          ok: false,
          error: new NotifyRpcProviderError({
            message: `VAPID transport: all ${results.length} subscription(s) failed`,
            code,
            provider: 'webpush-vapid',
            retriable,
            route: ctx.route,
            messageId: ctx.messageId,
          }),
        };
      }

      const data: WebPushTransportData = { results };
      return { ok: true, data };
    },
  });
};
