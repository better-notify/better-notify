import type { Transport } from '../transport.js';

export type CreateTransportOptions<TRendered = unknown, TData = unknown> = {
  name: string;
  send: Transport<TRendered, TData>['send'];
  verify?: Transport<TRendered, TData>['verify'];
  close?: Transport<TRendered, TData>['close'];
};

export const createTransport = <TRendered = unknown, TData = unknown>(
  opts: CreateTransportOptions<TRendered, TData>,
): Transport<TRendered, TData> => {
  return {
    name: opts.name,
    send: opts.send,
    verify: opts.verify ?? (async () => ({ ok: true })),
    close: opts.close ?? (async () => {}),
  };
};
