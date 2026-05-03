import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedSlack } from '../types.js';

export type SlackTransportData = {
  ts: string;
  channel: string;
};

export type SlackTransportResult = SlackTransportData;

export type Transport = CoreTransport<RenderedSlack, SlackTransportData>;
