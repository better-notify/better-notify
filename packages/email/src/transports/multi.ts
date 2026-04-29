import { multiTransport as coreMultiTransport } from '@betternotify/core/transports';
import type { MultiTransportOptions as CoreMultiTransportOptions } from '@betternotify/core/transports';
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
