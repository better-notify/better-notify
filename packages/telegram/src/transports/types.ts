import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedTelegram, TelegramChatId } from '../types.js';

export type TelegramTransportData = {
  messageId: number;
  chatId: TelegramChatId;
};

export type TelegramTransportResult = TelegramTransportData;

export type Transport = CoreTransport<RenderedTelegram, TelegramTransportData>;
