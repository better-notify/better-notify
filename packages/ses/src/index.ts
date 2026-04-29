import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { Transport } from '@betternotify/email/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';

/** @experimental AWS SES transport — not yet implemented; ships in v0.3. */
export type SesTransportOptions = {
  region: string;
  configurationSetName?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
};

/** @experimental AWS SES transport — not yet implemented; ships in v0.3. */
export const sesTransport = (_opts: SesTransportOptions): Transport => {
  throw new NotifyRpcNotImplementedError('@betternotify/ses transport (v0.3)');
};

/** @experimental AWS SES webhook adapter — not yet implemented; ships in v0.3. */
export type SesAdapterOptions = {
  verifySnsSignature?: boolean;
};

/** @experimental AWS SES webhook adapter — not yet implemented; ships in v0.3. */
export const sesAdapter = (_opts: SesAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/ses webhook adapter (v0.3)');
};
