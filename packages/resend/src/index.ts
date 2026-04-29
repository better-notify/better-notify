import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { Transport } from '@betternotify/email/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';

/** @experimental Resend transport — not yet implemented; ships in v0.3. */
export type ResendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
};

/** @experimental Resend transport — not yet implemented; ships in v0.3. */
export const resendTransport = (_opts: ResendTransportOptions): Transport => {
  throw new NotifyRpcNotImplementedError('@betternotify/resend transport (v0.3)');
};

/** @experimental Resend webhook adapter — not yet implemented; ships in v0.3. */
export type ResendAdapterOptions = {
  webhookSecret?: string;
};

/** @experimental Resend webhook adapter — not yet implemented; ships in v0.3. */
export const resendAdapter = (_opts: ResendAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/resend webhook adapter (v0.3)');
};
