import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedZapier } from '../types.js';

export type ZapierChannelTransportData = {
  status: number;
  raw: unknown;
};

export type Transport = CoreTransport<RenderedZapier, ZapierChannelTransportData>;
