import type { RenderedSms } from '../types.js';

export type SmsTransportResult = {
  messageId: string;
  provider?: string;
};

export type Transport = {
  readonly name: string;
  send(rendered: RenderedSms, ctx: unknown): Promise<SmsTransportResult>;
};
