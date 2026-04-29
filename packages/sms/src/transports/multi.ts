import {
  multiTransport as coreMultiTransport,
  createTransport as coreCreateTransport,
} from '@betternotify/core/transports';
import type {
  MultiTransportOptions as CoreMultiTransportOptions,
  CreateTransportOptions as CoreCreateTransportOptions,
} from '@betternotify/core/transports';
import type { RenderedSms } from '../types.js';
import type { SmsTransportData, Transport } from './types.js';

export type MultiTransportOptions = CoreMultiTransportOptions<RenderedSms, SmsTransportData>;
export type CreateTransportOptions = CoreCreateTransportOptions<RenderedSms, SmsTransportData>;

export const multiTransport = (opts: MultiTransportOptions): Transport =>
  coreMultiTransport<RenderedSms, SmsTransportData>(opts);

export const createTransport = (opts: CreateTransportOptions): Transport =>
  coreCreateTransport<RenderedSms, SmsTransportData>(opts);
