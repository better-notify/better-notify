export type PushDeviceToken = string;

export type PushSendArgs<TInput> = {
  to: PushDeviceToken | ReadonlyArray<PushDeviceToken>;
  input: TInput;
};

export type RenderedPush = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  to?: PushDeviceToken | ReadonlyArray<PushDeviceToken>;
};
