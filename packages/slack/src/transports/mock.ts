import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedSlack } from '../types.js';
import type { SlackTransportData } from './types.js';

export type MockSlackTransport = CoreMockTransport<RenderedSlack, SlackTransportData> & {
  readonly messages: ReadonlyArray<RenderedSlack & { id: string }>;
};

export const mockSlackTransport = (): MockSlackTransport => {
  let counter = 0;
  const messages: Array<RenderedSlack & { id: string }> = [];
  const base = createMockTransport<RenderedSlack, SlackTransportData>({
    name: 'mock-slack',
    reply: (rendered) => {
      counter += 1;
      const id = `slack-mock-${counter}`;
      messages.push({ ...rendered, id });
      return { ts: `mock-ts-${counter}`, channel: rendered.to ?? 'mock-channel' };
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};
