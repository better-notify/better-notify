import { multiTransport as coreMultiTransport } from '@emailrpc/core';
import type { MultiTransportOptions as CoreMultiTransportOptions } from '@emailrpc/core';
import type { RenderedMessage } from '../types.js';
import type { EmailTransportData, Transport } from './types.js';

export type {
  MultiTransportBackoff,
  MultiTransportEntry,
  MultiTransportOptions,
  MultiTransportStrategy,
} from './multi.types.js';

export const multiTransport = (
  opts: CoreMultiTransportOptions<RenderedMessage, EmailTransportData>,
): Transport => coreMultiTransport<RenderedMessage, EmailTransportData>(opts);
