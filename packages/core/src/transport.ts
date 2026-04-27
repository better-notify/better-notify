export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
};

export type TransportResult<TData = unknown> =
  | { ok: true; data: TData }
  | { ok: false; error: Error };

export type Transport<TRendered = unknown, TData = unknown> = {
  readonly name: string;
  send(rendered: TRendered, ctx: SendContext): Promise<TransportResult<TData>>;
  verify?(): Promise<{ ok: boolean; details?: unknown }>;
  close?(): Promise<void>;
};

export type AnyTransport = Transport<any, any>;
