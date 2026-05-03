import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedDiscord } from '../types.js';
import type { DiscordTransportData } from './types.js';

export type MockDiscordTransport = CoreMockTransport<RenderedDiscord, DiscordTransportData> & {
  readonly messages: ReadonlyArray<RenderedDiscord & { id: string }>;
};

export const mockDiscordTransport = (): MockDiscordTransport => {
  let counter = 0;
  const messages: Array<RenderedDiscord & { id: string }> = [];
  const base = createMockTransport<RenderedDiscord, DiscordTransportData>({
    name: 'mock-discord',
    reply: (rendered) => {
      counter += 1;
      const id = `discord-mock-${counter}`;
      messages.push({ ...rendered, id });
      return { transportMessageId: id, raw: {} };
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};
