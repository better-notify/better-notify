import type { Transport } from './types.js';
import type { RenderedSms } from '../types.js';

export const mockSmsTransport = () => {
  const messages: Array<RenderedSms & { id: string }> = [];
  let counter = 0;
  const t: Transport & { messages: typeof messages; reset: () => void } = {
    name: 'mock-sms',
    send: async (rendered) => {
      counter += 1;
      const id = `sms-mock-${counter}`;
      messages.push({ ...rendered, id });
      return { messageId: id };
    },
    messages,
    reset: () => {
      messages.length = 0;
      counter = 0;
    },
  };
  return t;
};
