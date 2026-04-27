import { defineChannel, slot } from '@emailrpc/core';
import type { RenderedSms, SmsSendArgs } from './types.js';

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

const validateSmsArgs = (args: unknown): SmsSendArgs => {
  if (!args || typeof args !== 'object') throw new Error('sms args must be an object');
  const a = args as Record<string, unknown>;
  if (typeof a.to !== 'string' || a.to.length === 0) {
    throw new Error('sms args.to must be a non-empty string');
  }
  return { to: a.to, input: a.input };
};

export const smsChannel = () =>
  defineChannel({
    name: 'sms' as const,
    slots: { body: slot.resolver<string>() },
    validateArgs: validateSmsArgs,
    render: ({ runtime, args }): RenderedSms => ({ body: runtime.body, to: args.to }),
  });
