import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { Provider } from '@emailrpc/core/provider';
import type { WebhookAdapter } from '@emailrpc/core/webhook';

export type SesOptions = {
  region: string;
  configurationSetName?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
};

export const ses = (_opts: SesOptions): Provider => {
  throw new EmailRpcNotImplementedError('@emailrpc/ses provider (v0.3)');
};

export type SesAdapterOptions = {
  verifySnsSignature?: boolean;
};

export const sesAdapter = (_opts: SesAdapterOptions = {}): WebhookAdapter => {
  throw new EmailRpcNotImplementedError('@emailrpc/ses webhook adapter (v0.3)');
};
