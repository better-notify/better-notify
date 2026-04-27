import type { Transport } from './types.js';

export type CreateTransportOptions = {
  name: string;
  send: Transport['send'];
  verify?: Transport['verify'];
  close?: Transport['close'];
};

/**
 * Build a `Transport` from a `send` function plus optional `verify`/`close`.
 *
 * Use this when implementing a new wire-level transport (REST API, in-house
 * SMTP wrapper, custom queue producer, etc.). The factory wires defaults so
 * you only have to provide the parts you care about — `verify` defaults to
 * `() => ({ ok: true })` and `close` defaults to a no-op.
 *
 * ```ts
 * const myTransport = createTransport({
 *   name: 'my-api',
 *   send: async (message, ctx) => {
 *     const res = await fetch('https://api.example.com/send', {
 *       method: 'POST',
 *       body: JSON.stringify({ to: message.to, subject: message.subject, html: message.html }),
 *     });
 *     return { accepted: [], rejected: [], transportMessageId: (await res.json()).id };
 *   },
 * });
 * ```
 */
export const createTransport = (opts: CreateTransportOptions): Transport => {
  return {
    name: opts.name,
    send: opts.send,
    verify: opts.verify ?? (async () => ({ ok: true })),
    close: opts.close ?? (async () => {}),
  };
};
