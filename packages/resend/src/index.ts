import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { Transport } from '@emailrpc/core/transports';
import type { WebhookAdapter } from '@emailrpc/core/webhook';

export type ResendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
};

export const resendTransport = (_opts: ResendTransportOptions): Transport => {
  throw new EmailRpcNotImplementedError('@emailrpc/resend transport (v0.3)');
};

export type ResendAdapterOptions = {
  webhookSecret?: string;
};

export const resendAdapter = (_opts: ResendAdapterOptions = {}): WebhookAdapter => {
  throw new EmailRpcNotImplementedError('@emailrpc/resend webhook adapter (v0.3)');
};
