import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedWhatsApp } from '../types.js';

export type WhatsappTransportData = {
  messageId: string;
  waId?: string;
};

export type Transport = CoreTransport<RenderedWhatsApp, WhatsappTransportData>;
