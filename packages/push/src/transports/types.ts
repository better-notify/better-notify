import type { RenderedPush } from '../types.js';

export type PushTransportResult = {
  messageId: string;
  provider?: string;
};

export type Transport = {
  readonly name: string;
  send(rendered: RenderedPush, ctx: unknown): Promise<PushTransportResult>;
};
