import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedTelegram } from '../types.js';
import type { TelegramTransportData } from './types.js';

export type MockTelegramTransport = CoreMockTransport<RenderedTelegram, TelegramTransportData> & {
  readonly messages: ReadonlyArray<RenderedTelegram & { id: string }>;
};

export const mockTelegramTransport = (): MockTelegramTransport => {
  let counter = 0;
  const messages: Array<RenderedTelegram & { id: string }> = [];
  const base = createMockTransport<RenderedTelegram, TelegramTransportData>({
    name: 'mock-telegram',
    reply: (rendered) => {
      counter += 1;
      const id = `telegram-mock-${counter}`;
      messages.push({ ...rendered, id });
      return { messageId: counter, chatId: rendered.to ?? '' };
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};
