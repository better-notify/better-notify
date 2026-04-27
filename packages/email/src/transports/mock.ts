import { createMockTransport } from '@betternotify/core';
import type { Priority, RenderedMessage, Tags } from '../types.js';
import type { EmailTransportData, Transport } from './types.js';
import { normalizeAddress } from '../lib/normalize-address.js';

type MockTransportRecord = {
  route: string;
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers: Record<string, string>;
  attachments: number;
  subject: string;
  html: string;
  text: string;
  tags?: Tags;
  priority?: Priority;
};

export type MockTransport = Transport & {
  readonly sent: ReadonlyArray<MockTransportRecord>;
  reset(): void;
};

export const mockTransport = (): MockTransport => {
  const records: MockTransportRecord[] = [];
  const base = createMockTransport<RenderedMessage, EmailTransportData>({
    name: 'mock',
    reply: (message, ctx) => {
      const to = message.to.map(normalizeAddress);
      records.push({
        route: ctx.route,
        from: message.from ? normalizeAddress(message.from) : undefined,
        to,
        cc: message.cc?.map(normalizeAddress),
        bcc: message.bcc?.map(normalizeAddress),
        replyTo: message.replyTo ? normalizeAddress(message.replyTo) : undefined,
        headers: message.headers ?? {},
        attachments: message.attachments?.length ?? 0,
        subject: message.subject,
        html: message.html,
        text: message.text ?? '',
        tags: message.tags,
        priority: message.priority,
      });
      return { accepted: to, rejected: [] };
    },
  });
  return {
    name: base.name,
    send: base.send,
    get sent() {
      return records;
    },
    reset() {
      records.length = 0;
      base.reset();
    },
  };
};
