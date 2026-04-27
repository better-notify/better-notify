import type { SendContext, Transport } from '../transport.js';

export type MapTransportFn<TRendered> = (
  rendered: TRendered,
  ctx: SendContext,
) => TRendered | Promise<TRendered>;

export const mapTransport = <TRendered, TData>(
  transport: Transport<TRendered, TData>,
  rewrite: MapTransportFn<TRendered>,
): Transport<TRendered, TData> => ({
  name: transport.name,
  verify: transport.verify,
  close: transport.close,
  send: async (rendered, ctx) => transport.send(await rewrite(rendered, ctx), ctx),
});
