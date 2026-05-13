export type WebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type WebPushAction = {
  action: string;
  title: string;
  icon?: string;
};

export type WebPushSendArgs<TInput> = {
  to: WebPushSubscription | ReadonlyArray<WebPushSubscription>;
  input: TInput;
};

export type RenderedWebPush = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: ReadonlyArray<WebPushAction>;
  to?: WebPushSubscription | ReadonlyArray<WebPushSubscription>;
};
