import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedSms } from '../types.js';
import type { SmsTransportData } from './types.js';

export type MockSmsTransport = CoreMockTransport<RenderedSms, SmsTransportData> & {
  readonly messages: ReadonlyArray<RenderedSms & { id: string }>;
};

export const mockSmsTransport = (): MockSmsTransport => {
  let counter = 0;
  const messages: Array<RenderedSms & { id: string }> = [];
  const base = createMockTransport<RenderedSms, SmsTransportData>({
    name: 'mock-sms',
    reply: (rendered) => {
      counter += 1;
      const id = `sms-mock-${counter}`;
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
