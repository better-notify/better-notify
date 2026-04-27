import type { Transport as CoreTransport } from '@emailrpc/core';
import type { RenderedPush } from '../types.js';

export type PushTransportData = {
  messageId: string;
  provider?: string;
};

export type PushTransportResult = PushTransportData;

export type Transport = CoreTransport<RenderedPush, PushTransportData>;
