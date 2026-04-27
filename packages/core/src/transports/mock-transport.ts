import type { SendContext, Transport, TransportResult } from '../transport.js';

export type CreateMockTransportOptions<TRendered, TData> = {
  name?: string;
  reply?: (rendered: TRendered, ctx: SendContext) => TData | Promise<TData>;
};

export type MockTransport<TRendered, TData> = Transport<TRendered, TData> & {
  readonly sent: ReadonlyArray<{ rendered: TRendered; ctx: SendContext }>;
  reset(): void;
};

export const createMockTransport = <TRendered = unknown, TData = unknown>(
  opts: CreateMockTransportOptions<TRendered, TData> = {},
): MockTransport<TRendered, TData> => {
  const records: Array<{ rendered: TRendered; ctx: SendContext }> = [];
  const reply = opts.reply ?? ((): TData => ({}) as TData);
  return {
    name: opts.name ?? 'mock',
    get sent() {
      return records;
    },
    async send(rendered, ctx): Promise<TransportResult<TData>> {
      records.push({ rendered, ctx });
      const data = await reply(rendered, ctx);
      return { ok: true, data };
    },
    reset() {
      records.length = 0;
    },
  };
};
