import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { Provider } from '@emailrpc/core/provider';
import type { WebhookAdapter } from '@emailrpc/core/webhook';

export interface ResendOptions {
  apiKey: string;
  baseUrl?: string;
}

export function resend(_opts: ResendOptions): Provider {
  throw new EmailRpcNotImplementedError('@emailrpc/resend provider (v0.3)');
}

export interface ResendAdapterOptions {
  webhookSecret?: string;
}

export function resendAdapter(_opts: ResendAdapterOptions = {}): WebhookAdapter {
  throw new EmailRpcNotImplementedError('@emailrpc/resend webhook adapter (v0.3)');
}
