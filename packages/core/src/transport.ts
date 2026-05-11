/**
 * Extensible registry for per-send transport overrides. Provider packages augment this
 * interface via `declare module '@betternotify/core'` to register their key and body type.
 * Multi-channel providers wrap their map in `PerChannel<T>` so the type narrows per-channel.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
export interface TransportDataMap {}

/**
 * Wrapper for multi-channel providers that maps channel names to body types.
 * Enables per-channel narrowing in `.send({ transport: { provider: { ... } } })`.
 * Single-channel providers register a flat body type instead.
 */
export type PerChannel<T extends Record<string, Record<string, unknown>>> = {
  readonly _perChannel: true;
  readonly channels: T;
};

type NarrowProviderData<T, TChannel extends string> =
  T extends PerChannel<infer M>
    ? TChannel extends keyof M
      ? M[TChannel]
      : M[keyof M & string]
    : T;

/**
 * Provider-keyed transport data narrowed by channel. Known providers get typed
 * autocomplete scoped to the channel; unknown providers fall back to `Record<string, unknown>`.
 */
export type TransportOverrides<TChannel extends string = string> = {
  [K in keyof TransportDataMap]?: NarrowProviderData<TransportDataMap[K], TChannel>;
} & Record<string, Record<string, unknown>>;

type UnwrapPerChannel<T> = T extends PerChannel<infer M> ? M[keyof M & string] : T;

/**
 * Wide transport data type for runtime contexts (SendContext) where the channel is not known.
 * `PerChannel` wrappers are unwrapped to their union of body types.
 */
export type TransportData = {
  [K in keyof TransportDataMap]?: UnwrapPerChannel<TransportDataMap[K]>;
} & Record<string, Record<string, unknown>>;

export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
  /** Per-send provider overrides passed from `.send({ transport: { ... } })`. */
  transport?: TransportData;
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
