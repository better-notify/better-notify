import type { RenderedMessage, SendContext } from '../types.js';
import type { Transport, TransportResult } from '../transports/types.js';
import { normalizeAddress } from './normalize-address.js';

type MockTransportRecord = {
  route: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers: Record<string, string>;
  attachments: number;
  subject: string;
  html: string;
  text: string;
};

export type MockTransport = Transport & {
  readonly sent: MockTransportRecord[];
  reset(): void;
};

export const mockTransport = (): MockTransport => {
  const records: MockTransportRecord[] = [];

  return {
    name: 'mock',
    get sent() {
      return records;
    },
    async send(message: RenderedMessage, ctx: SendContext): Promise<TransportResult> {
      const to = message.to.map(normalizeAddress);
      records.push({
        route: ctx.route,
        to,
        cc: message.cc?.map(normalizeAddress),
        bcc: message.bcc?.map(normalizeAddress),
        replyTo: message.replyTo ? normalizeAddress(message.replyTo) : undefined,
        headers: message.headers,
        attachments: message.attachments.length,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { accepted: to, rejected: [] };
    },
    reset() {
      records.length = 0;
    },
  };
};
