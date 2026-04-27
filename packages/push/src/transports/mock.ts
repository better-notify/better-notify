import type { Transport } from './types.js';
import type { RenderedPush } from '../types.js';

export const mockPushTransport = () => {
  const messages: Array<RenderedPush & { id: string }> = [];
  let counter = 0;
  const t: Transport & { messages: typeof messages; reset: () => void } = {
    name: 'mock-push',
    send: async (rendered) => {
      counter += 1;
      const id = `push-mock-${counter}`;
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
