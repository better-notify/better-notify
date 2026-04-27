import { multiTransport as coreMultiTransport, createTransport as coreCreateTransport } from '@emailrpc/core';
import type {
  MultiTransportOptions as CoreMultiTransportOptions,
  CreateTransportOptions as CoreCreateTransportOptions,
} from '@emailrpc/core';
import type { RenderedPush } from '../types.js';
import type { PushTransportData, Transport } from './types.js';

export type MultiTransportOptions = CoreMultiTransportOptions<RenderedPush, PushTransportData>;
export type CreateTransportOptions = CoreCreateTransportOptions<RenderedPush, PushTransportData>;

export const multiTransport = (opts: MultiTransportOptions): Transport =>
  coreMultiTransport<RenderedPush, PushTransportData>(opts);

export const createTransport = (opts: CreateTransportOptions): Transport =>
  coreCreateTransport<RenderedPush, PushTransportData>(opts);
