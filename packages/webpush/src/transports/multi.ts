import {
  multiTransport as coreMultiTransport,
  createTransport as coreCreateTransport,
} from '@betternotify/core/transports';
import type {
  MultiTransportOptions as CoreMultiTransportOptions,
  CreateTransportOptions as CoreCreateTransportOptions,
} from '@betternotify/core/transports';
import type { RenderedWebPush } from '../types.js';
import type { WebPushTransportData, Transport } from './types.js';

export type MultiTransportOptions = CoreMultiTransportOptions<
  RenderedWebPush,
  WebPushTransportData
>;
export type CreateTransportOptions = CoreCreateTransportOptions<
  RenderedWebPush,
  WebPushTransportData
>;

export const multiTransport = (opts: MultiTransportOptions): Transport =>
  coreMultiTransport<RenderedWebPush, WebPushTransportData>(opts);

export const createTransport = (opts: CreateTransportOptions): Transport =>
  coreCreateTransport<RenderedWebPush, WebPushTransportData>(opts);
