import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedWhatsApp } from '../types.js';
import type { WhatsappTransportData } from './types.js';

export type MockWhatsappTransport = CoreMockTransport<RenderedWhatsApp, WhatsappTransportData> & {
  readonly messages: ReadonlyArray<RenderedWhatsApp & { id: string }>;
};

export const mockWhatsappTransport = (): MockWhatsappTransport => {
  let counter = 0;
  const messages: Array<RenderedWhatsApp & { id: string }> = [];
  const base = createMockTransport<RenderedWhatsApp, WhatsappTransportData>({
    name: 'mock-whatsapp',
    reply: (rendered) => {
      counter += 1;
      const id = `wamid-mock-${counter}`;
      messages.push({ ...rendered, id });
      return { messageId: id };
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};
