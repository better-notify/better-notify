import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { Provider } from '@emailrpc/core/provider';
import type { WebhookAdapter } from '@emailrpc/core/webhook';

export interface SesOptions {
  region: string;
  configurationSetName?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
}

export function ses(_opts: SesOptions): Provider {
  throw new EmailRpcNotImplementedError('@emailrpc/ses provider (v0.3)');
}

export interface SesAdapterOptions {
  verifySnsSignature?: boolean;
}

export function sesAdapter(_opts: SesAdapterOptions = {}): WebhookAdapter {
  throw new EmailRpcNotImplementedError('@emailrpc/ses webhook adapter (v0.3)');
}
