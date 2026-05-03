import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedDiscord } from '../types.js';

export type DiscordTransportData = {
  transportMessageId?: string;
  raw: unknown;
};

export type Transport = CoreTransport<RenderedDiscord, DiscordTransportData>;
