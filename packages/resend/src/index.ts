import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { Transport } from '@betternotify/email/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';

export type ResendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
};

export const resendTransport = (_opts: ResendTransportOptions): Transport => {
  throw new NotifyRpcNotImplementedError('@betternotify/resend transport (v0.3)');
};

export type ResendAdapterOptions = {
  webhookSecret?: string;
};

export const resendAdapter = (_opts: ResendAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/resend webhook adapter (v0.3)');
};
