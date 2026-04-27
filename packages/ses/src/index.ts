import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { Transport } from '@emailrpc/email/transports';
import type { WebhookAdapter } from '@emailrpc/core/webhook';

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
  throw new EmailRpcNotImplementedError('@emailrpc/ses transport (v0.3)');
};

export type SesAdapterOptions = {
  verifySnsSignature?: boolean;
};

export const sesAdapter = (_opts: SesAdapterOptions = {}): WebhookAdapter => {
  throw new EmailRpcNotImplementedError('@emailrpc/ses webhook adapter (v0.3)');
};
