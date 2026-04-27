import {
  multiTransport as coreMultiTransport,
  createTransport as coreCreateTransport,
} from '@emailrpc/core';
import type {
  MultiTransportOptions as CoreMultiTransportOptions,
  CreateTransportOptions as CoreCreateTransportOptions,
} from '@emailrpc/core';
import type { RenderedSms } from '../types.js';
import type { SmsTransportData, Transport } from './types.js';

export type MultiTransportOptions = CoreMultiTransportOptions<RenderedSms, SmsTransportData>;
export type CreateTransportOptions = CoreCreateTransportOptions<RenderedSms, SmsTransportData>;

export const multiTransport = (opts: MultiTransportOptions): Transport =>
  coreMultiTransport<RenderedSms, SmsTransportData>(opts);

export const createTransport = (opts: CreateTransportOptions): Transport =>
  coreCreateTransport<RenderedSms, SmsTransportData>(opts);
