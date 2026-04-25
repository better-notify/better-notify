import { EmailRpcNotImplementedError } from './errors.js';
import type { RenderedMessage, SendContext } from './types.js';

export interface ProviderResult {
  providerMessageId?: string;
  accepted: string[];
  rejected: string[];
  raw?: unknown;
}

export interface Provider {
  name: string;
  send(message: RenderedMessage, ctx: SendContext): Promise<ProviderResult>;
  verify?(): Promise<{ ok: boolean; details?: unknown }>;
  close?(): Promise<void>;
}

export interface SmtpOptions {
  host: string;
  port: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  dkim?: { domainName: string; keySelector: string; privateKey: string };
}

export function smtp(_opts: SmtpOptions): Provider {
  throw new EmailRpcNotImplementedError('smtp() provider');
}

export interface MultiProviderEntry {
  provider: Provider;
  weight?: number;
}

export interface MultiOptions {
  strategy: 'failover' | 'round-robin' | 'weighted';
  providers: MultiProviderEntry[];
  isRetriable?: (err: unknown) => boolean;
}

export function multi(_opts: MultiOptions): Provider {
  throw new EmailRpcNotImplementedError('multi() provider');
}
