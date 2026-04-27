import { defineChannel, slot } from '@emailrpc/core';
import type { PushDeviceToken, PushSendArgs, RenderedPush } from './types.js';

export type TitleResolver<TInput> = string | ((args: { input: TInput }) => string);
export type BodyResolver<TInput> = string | ((args: { input: TInput }) => string);
export type DataResolver<TInput> = Record<string, unknown> | ((args: { input: TInput }) => Record<string, unknown>);
export type BadgeResolver<TInput> = number | ((args: { input: TInput }) => number);

const validatePushArgs = (args: unknown): PushSendArgs<unknown> => {
  if (!args || typeof args !== 'object') throw new Error('push args must be an object');
  const a = args as Record<string, unknown>;
  if (typeof a.to === 'string') {
    if (a.to.length === 0)
      throw new Error('push args.to must be a non-empty string or non-empty array');
    return { to: a.to, input: a.input } as PushSendArgs<unknown>;
  }
  if (Array.isArray(a.to)) {
    if (a.to.length === 0)
      throw new Error('push args.to must be a non-empty string or non-empty array');
    return {
      to: a.to as ReadonlyArray<PushDeviceToken>,
      input: a.input,
    } as PushSendArgs<unknown>;
  }
  throw new Error('push args.to must be a non-empty string or non-empty array');
};

export const pushChannel = () =>
  defineChannel({
    name: 'push' as const,
    slots: {
      title: slot.resolver<string>(),
      body: slot.resolver<string>(),
      data: slot.resolver<Record<string, unknown>>().optional(),
      badge: slot.resolver<number>().optional(),
    },
    validateArgs: validatePushArgs,
    render: ({ runtime, args }): RenderedPush => {
      const title = typeof runtime.title === 'function' ? runtime.title({ input: args.input }) : runtime.title;
      const body = typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body;
      const result: RenderedPush = { title, body, to: args.to };
      if (runtime.data !== undefined) {
        result.data =
          typeof runtime.data === 'function' ? runtime.data({ input: args.input }) : runtime.data;
      }
      if (runtime.badge !== undefined) {
        result.badge =
          typeof runtime.badge === 'function' ? runtime.badge({ input: args.input }) : runtime.badge;
      }
      return result;
    },
  });
