import { defineChannel, slot } from '@emailrpc/core';
import type { RenderedSms, SmsSendArgs } from './types.js';

export type BodyResolver<TInput> = string | ((args: { input: TInput }) => string);

const validateSmsArgs = (args: unknown): SmsSendArgs<unknown> => {
  if (!args || typeof args !== 'object') throw new Error('sms args must be an object');
  const a = args as Record<string, unknown>;
  if (typeof a.to !== 'string' || a.to.length === 0) {
    throw new Error('sms args.to must be a non-empty string');
  }
  return { to: a.to, input: a.input } as SmsSendArgs<unknown>;
};

export const smsChannel = () =>
  defineChannel({
    name: 'sms' as const,
    slots: { body: slot.resolver<string>() },
    validateArgs: validateSmsArgs,
    render: ({ runtime, args }): RenderedSms => {
      const body = typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body;
      return { body, to: args.to };
    },
  });
