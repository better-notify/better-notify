import { createMockTransport } from '@betternotify/core';
import type { MockTransport as CoreMockTransport } from '@betternotify/core';
import type { RenderedPush } from '../types.js';
import type { PushTransportData } from './types.js';

export type MockPushTransport = CoreMockTransport<RenderedPush, PushTransportData> & {
  readonly messages: ReadonlyArray<RenderedPush & { id: string }>;
};

export const mockPushTransport = (): MockPushTransport => {
  let counter = 0;
  const messages: Array<RenderedPush & { id: string }> = [];
  const base = createMockTransport<RenderedPush, PushTransportData>({
    name: 'mock-push',
    reply: (rendered) => {
      counter += 1;
      const id = `push-mock-${counter}`;
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
