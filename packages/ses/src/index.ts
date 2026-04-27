import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { Transport } from '@betternotify/email/transports';
import type { WebhookAdapter } from '@betternotify/core/webhook';

export type SesTransportOptions = {
  region: string;
  configurationSetName?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
};

export const sesTransport = (_opts: SesTransportOptions): Transport => {
  throw new NotifyRpcNotImplementedError('@betternotify/ses transport (v0.3)');
};

export type SesAdapterOptions = {
  verifySnsSignature?: boolean;
};

export const sesAdapter = (_opts: SesAdapterOptions = {}): WebhookAdapter => {
  throw new NotifyRpcNotImplementedError('@betternotify/ses webhook adapter (v0.3)');
};
