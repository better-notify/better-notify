import { defineChannel, slot } from '@betternotify/core';
import type {
  WebPushAction,
  WebPushSendArgs,
  WebPushSubscription,
  RenderedWebPush,
} from './types.js';

export type TitleResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type IconResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type BadgeResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type ImageResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type TagResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type DataResolver<TInput> =
  | Record<string, unknown>
  | ((args: { input: TInput; ctx: unknown }) => Record<string, unknown>);
export type ActionsResolver<TInput> =
  | ReadonlyArray<WebPushAction>
  | ((args: { input: TInput; ctx: unknown }) => ReadonlyArray<WebPushAction>);

const isSubscription = (v: unknown): v is WebPushSubscription =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as WebPushSubscription).endpoint === 'string' &&
  typeof (v as WebPushSubscription).keys === 'object' &&
  (v as WebPushSubscription).keys !== null &&
  typeof (v as WebPushSubscription).keys.p256dh === 'string' &&
  typeof (v as WebPushSubscription).keys.auth === 'string';

const validateWebPushArgs = (args: unknown): WebPushSendArgs<unknown> => {
  if (!args || typeof args !== 'object') throw new Error('webpush args must be an object');
  const a = args as Record<string, unknown>;

  if (isSubscription(a.to)) {
    if (a.to.endpoint.length === 0)
      throw new Error('webpush subscription endpoint must be non-empty');
    return { to: a.to, input: a.input } as WebPushSendArgs<unknown>;
  }

  if (Array.isArray(a.to)) {
    if (a.to.length === 0)
      throw new Error('webpush args.to must be a subscription or non-empty array of subscriptions');
    for (const sub of a.to) {
      if (!isSubscription(sub))
        throw new Error(
          'webpush args.to array items must be subscription objects with endpoint and keys',
        );
    }
    return {
      to: a.to as ReadonlyArray<WebPushSubscription>,
      input: a.input,
    } as WebPushSendArgs<unknown>;
  }

  throw new Error(
    'webpush args.to must be a subscription object with endpoint and keys, or an array of them',
  );
};

export const webPushChannel = () =>
  defineChannel({
    name: 'webpush' as const,
    slots: {
      title: slot.resolver<string>(),
      body: slot.resolver<string>(),
      icon: slot.resolver<string>().optional(),
      badge: slot.resolver<string>().optional(),
      image: slot.resolver<string>().optional(),
      tag: slot.resolver<string>().optional(),
      data: slot.resolver<Record<string, unknown>>().optional(),
      actions: slot.resolver<ReadonlyArray<WebPushAction>>().optional(),
    },
    validateArgs: validateWebPushArgs,
    render: ({ runtime, args }): RenderedWebPush => {
      const result: RenderedWebPush = { title: runtime.title, body: runtime.body, to: args.to };
      if (runtime.icon !== undefined) result.icon = runtime.icon;
      if (runtime.badge !== undefined) result.badge = runtime.badge;
      if (runtime.image !== undefined) result.image = runtime.image;
      if (runtime.tag !== undefined) result.tag = runtime.tag;
      if (runtime.data !== undefined) result.data = runtime.data;
      if (runtime.actions !== undefined) result.actions = runtime.actions;
      return result;
    },
  });
