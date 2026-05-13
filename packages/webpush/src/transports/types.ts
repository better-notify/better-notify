import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedWebPush } from '../types.js';

export type WebPushSubscriptionResult = {
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  gone?: boolean;
};

export type WebPushTransportData = {
  results: ReadonlyArray<WebPushSubscriptionResult>;
};

export type WebPushTransportResult = WebPushTransportData;

export type Transport = CoreTransport<RenderedWebPush, WebPushTransportData>;
